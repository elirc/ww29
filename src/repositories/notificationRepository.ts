/*
 * This file contains the main notification and batch persistence operations.
 * It is called by `src/services/notificationService.ts` and `src/services/monitoringService.ts`.
 * It calls Prisma through `src/lib/db.ts` and cooperates with `src/repositories/deliveryRepository.ts` for per-channel records.
 * A junior engineer often mixes aggregate status updates directly into route handlers, which makes async state transitions very easy to miss.
 */
import {
  BatchStatus,
  DeliveryStatus,
  NotificationStatus,
  Prisma,
  UserRole
} from "@prisma/client";

import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function createNotificationBatch(
  input: {
    createdById: string;
    name: string;
    recipientCount: number;
    channels: Array<"EMAIL" | "SMS" | "PUSH">;
    scheduledFor: Date | null;
    metadata?: Prisma.InputJsonValue;
  },
  db: Prisma.TransactionClient
) {
  return db.notificationBatch.create({
    data: {
      createdById: input.createdById,
      name: input.name,
      recipientCount: input.recipientCount,
      channels: input.channels,
      scheduledFor: input.scheduledFor,
      metadata: input.metadata
    }
  });
}

export async function createNotification(
  input: {
    batchId: string;
    recipientUserId: string;
    personalizedData: Prisma.InputJsonValue;
  },
  db: Prisma.TransactionClient
) {
  return db.notification.create({
    data: {
      batchId: input.batchId,
      recipientUserId: input.recipientUserId,
      personalizedData: input.personalizedData
    }
  });
}

export async function listNotificationsForActor(input: {
  actorUserId: string;
  actorRole: UserRole;
  mine: boolean;
  status?: string;
}) {
  // ⚠️ SENIOR NOTE: Ownership scoping belongs in the repository query itself so a future caller cannot forget to filter the dataset.
  const scopedToSelf = input.actorRole === UserRole.VIEWER || input.mine;

  return prisma.notification.findMany({
    where: {
      recipientUserId: scopedToSelf ? input.actorUserId : undefined,
      status: input.status ? (input.status as NotificationStatus) : undefined
    },
    include: {
      recipient: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      batch: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true
        }
      },
      deliveries: {
        select: {
          id: true,
          channel: true,
          status: true,
          sentAt: true,
          openedAt: true,
          failureMessage: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function findNotificationDetail(notificationId: string) {
  return prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      recipient: {
        include: {
          preferences: true
        }
      },
      batch: {
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      deliveries: {
        include: {
          attempts: {
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationStatus,
  db: DbClient = prisma
) {
  return db.notification.update({
    where: { id: notificationId },
    data: { status }
  });
}

export async function updateNotificationOpenedAt(
  notificationId: string,
  db: DbClient = prisma
) {
  return db.notification.update({
    where: { id: notificationId },
    data: {
      openedAt: new Date()
    }
  });
}

export async function updateBatchStatus(
  batchId: string,
  status: BatchStatus,
  db: DbClient = prisma
) {
  return db.notificationBatch.update({
    where: { id: batchId },
    data: { status }
  });
}

export async function getNotificationStatusesForBatch(batchId: string, db: DbClient = prisma) {
  return db.notification.findMany({
    where: { batchId },
    select: {
      id: true,
      status: true
    }
  });
}

export async function getDeliveryStatusesForNotification(
  notificationId: string,
  db: DbClient = prisma
) {
  return db.notificationDelivery.findMany({
    where: { notificationId },
    select: {
      id: true,
      status: true
    }
  });
}

export async function countBatchesByStatus() {
  return prisma.notificationBatch.groupBy({
    by: ["status"],
    _count: {
      _all: true
    }
  });
}

export async function listRecentBatches(limit = 6) {
  return prisma.notificationBatch.findMany({
    include: {
      createdBy: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export function deriveNotificationStatus(statuses: DeliveryStatus[]) {
  if (statuses.length === 0) {
    return NotificationStatus.QUEUED;
  }

  const completedStatuses: DeliveryStatus[] = [
    DeliveryStatus.SENT,
    DeliveryStatus.OPENED,
    DeliveryStatus.SKIPPED
  ];
  const failedStatuses: DeliveryStatus[] = [
    DeliveryStatus.FAILED,
    DeliveryStatus.SKIPPED
  ];
  const deliveredStatuses: DeliveryStatus[] = [
    DeliveryStatus.SENT,
    DeliveryStatus.OPENED
  ];

  const allCompleted = statuses.every((status) => completedStatuses.includes(status));

  if (allCompleted) {
    return NotificationStatus.COMPLETED;
  }

  const allFailed = statuses.every((status) => failedStatuses.includes(status));

  if (allFailed) {
    return NotificationStatus.FAILED;
  }

  const hasCompleted = statuses.some((status) => deliveredStatuses.includes(status));
  const hasFailed = statuses.includes(DeliveryStatus.FAILED);

  if (hasCompleted && hasFailed) {
    return NotificationStatus.PARTIAL_FAILURE;
  }

  return statuses.includes(DeliveryStatus.PROCESSING)
    ? NotificationStatus.PROCESSING
    : NotificationStatus.QUEUED;
}

export function deriveBatchStatus(statuses: NotificationStatus[]) {
  if (statuses.length === 0) {
    return BatchStatus.QUEUED;
  }

  if (statuses.every((status) => status === NotificationStatus.COMPLETED)) {
    return BatchStatus.COMPLETED;
  }

  if (statuses.every((status) => status === NotificationStatus.FAILED)) {
    return BatchStatus.FAILED;
  }

  if (
    statuses.some((status) => status === NotificationStatus.COMPLETED) &&
    statuses.some(
      (status) =>
        status === NotificationStatus.FAILED ||
        status === NotificationStatus.PARTIAL_FAILURE
    )
  ) {
    return BatchStatus.PARTIAL_FAILURE;
  }

  return statuses.includes(NotificationStatus.PROCESSING)
    ? BatchStatus.PROCESSING
    : BatchStatus.QUEUED;
}
