/*
 * This file centralizes audit log writes for security-sensitive business actions.
 * It is called by services such as `src/services/notificationService.ts` and `src/services/preferenceService.ts`.
 * It calls Prisma through `src/lib/db.ts`.
 * A junior engineer often adds logging as console output instead of durable audit records, which leaves no trustworthy operational history later.
 */
import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function createAuditLog(
  input: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Prisma.InputJsonValue;
  },
  db: DbClient = prisma
) {
  // ⚠️ SENIOR NOTE: Security-sensitive writes go through a single helper so audit payload shape stays predictable for later monitoring and forensics.
  return db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload
    }
  });
}
