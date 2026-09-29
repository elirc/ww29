/*
 * This file owns persistence for user notification preferences.
 * It is called by `src/services/preferenceService.ts` and by notification creation logic in `src/services/notificationService.ts`.
 * It calls Prisma through `src/lib/db.ts`.
 * A junior engineer often treats preferences as optional UI state, but this table is a compliance boundary because opt-out decisions affect delivery eligibility.
 */
import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getPreferenceForUser(userId: string, db: DbClient = prisma) {
  return db.userPreference.findUnique({
    where: { userId }
  });
}

export async function upsertPreferenceForUser(
  userId: string,
  input: {
    emailOptIn: boolean;
    smsOptIn: boolean;
    pushOptIn: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  },
  db: DbClient = prisma
) {
  // ⚠️ SENIOR NOTE: `upsert` keeps preference writes idempotent, which matters when UI retries or concurrent saves happen.
  return db.userPreference.upsert({
    where: { userId },
    update: input,
    create: {
      userId,
      ...input
    }
  });
}
