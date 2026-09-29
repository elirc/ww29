/*
 * This file contains all database queries for user lookups used by auth, recipient resolution, and ownership checks.
 * It is called by `src/services/authService.ts` and `src/services/notificationService.ts`.
 * It calls Prisma through `src/lib/db.ts`.
 * A junior engineer often queries users ad hoc from services, which spreads ownership logic across the codebase and makes scoping bugs easier to introduce.
 */
import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function findUserByEmail(email: string, db: DbClient = prisma) {
  return db.user.findUnique({
    where: { email },
    include: { preferences: true }
  });
}

export async function findUserById(userId: string, db: DbClient = prisma) {
  return db.user.findUnique({
    where: { id: userId },
    include: { preferences: true }
  });
}

export async function findRecipientsByIds(userIds: string[], db: DbClient = prisma) {
  // ⚠️ SENIOR NOTE: Recipient resolution happens in one query so later batch creation can verify missing IDs before any writes begin.
  return db.user.findMany({
    where: {
      id: {
        in: userIds
      }
    },
    include: {
      preferences: true
    }
  });
}

export async function listRecipientDirectory(db: DbClient = prisma) {
  return db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });
}
