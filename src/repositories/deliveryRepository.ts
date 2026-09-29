/*
 * This file owns the queue-table queries for claiming, updating, and inspecting deliveries.
 * It is called by `src/services/workerService.ts`, `src/services/notificationService.ts`, and monitoring code.
 * It calls Prisma and a small amount of Postgres SQL for `FOR UPDATE SKIP LOCKED` claim semantics.
 * A junior engineer often builds async processing without lock ownership or lease expiry, which causes duplicate sends under concurrent workers.
 */
import { DeliveryStatus, Prisma, type NotificationChannel } from "@prisma/client";

import { prisma } from "@/lib/db";

const LOCK_TIMEOUT_MINUTES = 5;

export async function claimDueDeliveries(workerId: string, limit: number) {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);

  // ⚠️ SENIOR NOTE: The claim is a single SQL statement so lock acquisition and status transition happen atomically under concurrent workers.
  const claimedIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH due AS (
        SELECT "id"
        FROM "NotificationDelivery"
        WHERE "status" IN (
          'QUEUED'::"DeliveryStatus",
          'RETRYING'::"DeliveryStatus",
          'RATE_LIMITED'::"DeliveryStatus"
        )
          AND "availableAt" <= NOW()
          AND ("lockedAt" IS NULL OR "lockedAt" < ${staleBefore})
        ORDER BY "availableAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationDelivery"
      SET
        "status" = 'PROCESSING'::"DeliveryStatus",
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "updatedAt" = NOW()
      WHERE "id" IN (SELECT "id" FROM due)
      RETURNING "id"
    `
  );

  if (claimedIds.length === 0) {
    return [];
  }

  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      id: {
        in: claimedIds.map((row) => row.id)
      }
    },
    include: {
      notification: {
        include: {
          batch: true,
          recipient: {
            include: {
              preferences: true
            }
          }
        }
      }
    }
  });

  return deliveries.sort(
    (a, b) =>
      claimedIds.findIndex((row) => row.id === a.id) -
      claimedIds.findIndex((row) => row.id === b.id)
  );
}

export async function createDeliveryAttempt(input: {
  deliveryId: string;
  attemptNumber: number;
  result: "SENT" | "FAILED" | "RATE_LIMITED";
  errorMessage?: string | null;
  responsePayload?: Prisma.InputJsonValue;
}) {
  return prisma.deliveryAttempt.create({
    data: {
      deliveryId: input.deliveryId,
      attemptNumber: input.attemptNumber,
      result: input.result,
      errorMessage: input.errorMessage ?? null,
      responsePayload: input.responsePayload
    }
  });
}

export async function markDeliverySent(input: {
  deliveryId: string;
  providerMessageId: string;
}) {
  return prisma.notificationDelivery.update({
    where: { id: input.deliveryId },
    data: {
      status: DeliveryStatus.SENT,
      providerMessageId: input.providerMessageId,
      lastAttemptAt: new Date(),
      sentAt: new Date(),
      attemptCount: {
        increment: 1
      },
      lockedAt: null,
      lockedBy: null,
      failureCode: null,
      failureMessage: null
    }
  });
}

export async function markDeliveryDeferred(input: {
  deliveryId: string;
  status: "RETRYING" | "RATE_LIMITED";
  availableAt: Date;
  failureMessage: string;
}) {
  return prisma.notificationDelivery.update({
    where: { id: input.deliveryId },
    data: {
      status: input.status,
      availableAt: input.availableAt,
      failureMessage: input.failureMessage,
      lastAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null
    }
  });
}

export async function markDeliveryFailed(input: {
  deliveryId: string;
  failureCode: string;
  failureMessage: string;
}) {
  return prisma.notificationDelivery.update({
    where: { id: input.deliveryId },
    data: {
      status: DeliveryStatus.FAILED,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      lastAttemptAt: new Date(),
      attemptCount: {
        increment: 1
      },
      lockedAt: null,
      lockedBy: null
    }
  });
}

export async function markDeliveryOpened(deliveryIds: string[]) {
  return prisma.notificationDelivery.updateMany({
    where: {
      id: {
        in: deliveryIds
      },
      status: DeliveryStatus.SENT
    },
    data: {
      status: DeliveryStatus.OPENED,
      openedAt: new Date()
    }
  });
}

export async function countDeliveriesByStatus() {
  return prisma.notificationDelivery.groupBy({
    by: ["status"],
    _count: {
      _all: true
    }
  });
}

export async function countStaleProcessingDeliveries() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);

  return prisma.notificationDelivery.count({
    where: {
      status: DeliveryStatus.PROCESSING,
      lockedAt: {
        lt: staleBefore
      }
    }
  });
}

export async function listRecentFailedDeliveries(limit = 8) {
  return prisma.notificationDelivery.findMany({
    where: {
      status: DeliveryStatus.FAILED
    },
    include: {
      notification: {
        include: {
          recipient: true,
          batch: true
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: limit
  });
}

export async function createNotificationDelivery(
  input: {
    notificationId: string;
    channel: NotificationChannel;
    renderedSubject: string | null;
    renderedBody: string;
    status: DeliveryStatus;
    availableAt: Date;
    failureMessage?: string | null;
  },
  db: Prisma.TransactionClient
) {
  return db.notificationDelivery.create({
    data: {
      notificationId: input.notificationId,
      channel: input.channel,
      renderedSubject: input.renderedSubject,
      renderedBody: input.renderedBody,
      status: input.status,
      availableAt: input.availableAt,
      failureMessage: input.failureMessage ?? null
    }
  });
}
