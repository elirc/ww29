/*
 * This file owns the main notification workflows: batch creation, scoped reads, and open tracking.
 * It is called by `src/app/api/notifications/route.ts` and `src/app/api/notifications/[id]/open/route.ts`.
 * It calls repositories, template rendering utilities, and audit logging helpers.
 * A junior engineer often pushes this workflow into route handlers, which hides transaction boundaries and makes async states impossible to reason about.
 */
import {
  DeliveryStatus,
  NotificationChannel,
  type Prisma
} from "@prisma/client";

import type { SessionUser } from "@/lib/auth/session";
import { can, requireAction } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http/api-errors";
import {
  buildMessageValues,
  isChannelOptedIn,
  isWithinQuietHours,
  renderTemplate,
  resolveChannelTarget
} from "@/lib/notifications/rendering";
import type { CreateNotificationBatchInput } from "@/lib/validation/notificationSchemas";
import { createAuditLog } from "@/repositories/auditLogRepository";
import {
  createNotificationDelivery,
  markDeliveryOpened
} from "@/repositories/deliveryRepository";
import {
  createNotification,
  createNotificationBatch,
  deriveBatchStatus,
  deriveNotificationStatus,
  findNotificationDetail,
  getDeliveryStatusesForNotification,
  getNotificationStatusesForBatch,
  listNotificationsForActor,
  updateBatchStatus,
  updateNotificationOpenedAt,
  updateNotificationStatus
} from "@/repositories/notificationRepository";
import { findTemplateById, listTemplates } from "@/repositories/templateRepository";
import { findRecipientsByIds, listRecipientDirectory } from "@/repositories/userRepository";

function getQuietHoursResumeAt(date: Date, quietHoursEnd: number) {
  const resumeAt = new Date(date);
  resumeAt.setHours(quietHoursEnd, 0, 0, 0);

  if (resumeAt <= date) {
    resumeAt.setDate(resumeAt.getDate() + 1);
  }

  return resumeAt;
}

async function refreshNotificationAndBatchState(notificationId: string, batchId: string) {
  const deliveryStates = await getDeliveryStatusesForNotification(notificationId);
  const nextNotificationStatus = deriveNotificationStatus(
    deliveryStates.map((delivery) => delivery.status)
  );

  await updateNotificationStatus(notificationId, nextNotificationStatus);

  const notificationStates = await getNotificationStatusesForBatch(batchId);
  const nextBatchStatus = deriveBatchStatus(
    notificationStates.map((notification) => notification.status)
  );

  await updateBatchStatus(batchId, nextBatchStatus);
}

export async function getNotificationComposerData() {
  const [templates, recipients] = await Promise.all([
    listTemplates(),
    listRecipientDirectory()
  ]);

  return {
    templates,
    recipients
  };
}

export async function createNotificationBatchForSession(
  session: SessionUser,
  input: CreateNotificationBatchInput
) {
  requireAction(session.role, "notifications:create");

  if (input.templateId && input.channels.length !== 1) {
    throw new ApiError(
      400,
      "Template-driven batches currently support one channel at a time so rendering stays explicit."
    );
  }

  const recipientValueMap = new Map(
    input.recipientData.map((entry) => [entry.userId, entry.values])
  );

  const [recipients, template] = await Promise.all([
    findRecipientsByIds(input.recipientUserIds),
    input.templateId ? findTemplateById(input.templateId) : Promise.resolve(null)
  ]);

  if (recipients.length !== input.recipientUserIds.length) {
    throw new ApiError(404, "One or more recipients were not found.");
  }

  if (template && template.channel !== input.channels[0]) {
    throw new ApiError(400, "The selected template does not match the requested channel.");
  }

  // ⚠️ SENIOR NOTE: Batch creation stays inside one transaction so we never enqueue a partial set of notifications without a parent batch record.
  const createdBatch = await prisma.$transaction(async (tx) => {
    const batch = await createNotificationBatch(
      {
        createdById: session.userId,
        name: input.name,
        recipientCount: recipients.length,
        channels: input.channels,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        metadata: {
          source: "dashboard",
          templateId: input.templateId
        }
      },
      tx
    );

    for (const recipient of recipients) {
      const messageValues = buildMessageValues(
        input.personalizationDefaults,
        recipientValueMap.get(recipient.id) ?? {},
        recipient.name
      );

      const notification = await createNotification(
        {
          batchId: batch.id,
          recipientUserId: recipient.id,
          personalizedData: messageValues as Prisma.InputJsonValue
        },
        tx
      );

      for (const channel of input.channels) {
        const requestedTime = input.scheduledFor
          ? new Date(input.scheduledFor)
          : new Date();

        const renderedSubject =
          channel === NotificationChannel.EMAIL
            ? renderTemplate({
                template: template?.subjectTemplate ?? input.subject ?? "",
                values: messageValues
              }) || null
            : null;

        const renderedBody = renderTemplate({
          template: template?.bodyTemplate ?? input.body ?? "",
          values: messageValues
        });

        const target = resolveChannelTarget(channel, recipient);
        const optedIn = isChannelOptedIn(recipient.preferences, channel);

        if (!optedIn) {
          await createNotificationDelivery(
            {
              notificationId: notification.id,
              channel,
              renderedSubject,
              renderedBody,
              status: DeliveryStatus.SKIPPED,
              availableAt: requestedTime,
              failureMessage: "Recipient has opted out of this channel."
            },
            tx
          );
          continue;
        }

        if (!target) {
          await createNotificationDelivery(
            {
              notificationId: notification.id,
              channel,
              renderedSubject,
              renderedBody,
              status: DeliveryStatus.SKIPPED,
              availableAt: requestedTime,
              failureMessage: "Recipient is missing a destination for this channel."
            },
            tx
          );
          continue;
        }

        const availableAt = isWithinQuietHours(recipient.preferences, requestedTime)
          ? getQuietHoursResumeAt(
              requestedTime,
              recipient.preferences?.quietHoursEnd ?? requestedTime.getHours()
            )
          : requestedTime;

        await createNotificationDelivery(
          {
            notificationId: notification.id,
            channel,
            renderedSubject,
            renderedBody,
            status: DeliveryStatus.QUEUED,
            availableAt
          },
          tx
        );
      }
    }

    await createAuditLog(
      {
        actorUserId: session.userId,
        action: "notifications.batch_created",
        entityType: "NotificationBatch",
        entityId: batch.id,
        payload: {
          name: input.name,
          recipientCount: recipients.length,
          channels: input.channels
        }
      },
      tx
    );

    return batch;
  });

  return {
    batch: createdBatch
  };
}

export async function listNotificationsForSession(
  session: SessionUser,
  input: { mine: boolean; status?: string }
) {
  return {
    notifications: await listNotificationsForActor({
      actorUserId: session.userId,
      actorRole: session.role,
      mine: input.mine,
      status: input.status
    })
  };
}

export async function getNotificationDetailForSession(
  session: SessionUser,
  notificationId: string
) {
  const notification = await findNotificationDetail(notificationId);

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  const canViewAny = can(session.role, "notifications:view:any");

  if (!canViewAny && notification.recipientUserId !== session.userId) {
    throw new ApiError(404, "Notification not found.");
  }

  return {
    notification
  };
}

export async function markNotificationOpenedForSession(
  session: SessionUser,
  notificationId: string
) {
  requireAction(session.role, "notifications:open:own");

  const notification = await findNotificationDetail(notificationId);

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  const canViewAny = can(session.role, "notifications:view:any");

  if (!canViewAny && notification.recipientUserId !== session.userId) {
    throw new ApiError(404, "Notification not found.");
  }

  const sentDeliveryIds = notification.deliveries
    .filter((delivery) => delivery.status === DeliveryStatus.SENT)
    .map((delivery) => delivery.id);

  if (sentDeliveryIds.length === 0) {
    throw new ApiError(409, "Only sent notifications can transition to opened.");
  }

  await markDeliveryOpened(sentDeliveryIds);
  await updateNotificationOpenedAt(notification.id);
  await refreshNotificationAndBatchState(notification.id, notification.batchId);

  await createAuditLog({
    actorUserId: session.userId,
    action: "notifications.opened",
    entityType: "Notification",
    entityId: notification.id,
    payload: {
      openedDeliveryIds: sentDeliveryIds
    }
  });

  return {
    opened: true
  };
}

export async function recomputeNotificationState(notificationId: string) {
  const detail = await findNotificationDetail(notificationId);

  if (!detail) {
    throw new ApiError(404, "Notification not found.");
  }

  await refreshNotificationAndBatchState(detail.id, detail.batchId);
}
