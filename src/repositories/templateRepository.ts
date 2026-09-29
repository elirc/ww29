/*
 * This file contains database access for notification templates.
 * It is called by `src/services/notificationService.ts` when batches reference reusable templates.
 * It calls Prisma through `src/lib/db.ts`.
 * A junior engineer often skips repository boundaries for small tables like templates, but that makes future constraints and caching harder to centralize.
 */
import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function listTemplates(db: DbClient = prisma) {
  return db.notificationTemplate.findMany({
    orderBy: [{ channel: "asc" }, { name: "asc" }]
  });
}

export async function findTemplateById(templateId: string, db: DbClient = prisma) {
  return db.notificationTemplate.findUnique({
    where: { id: templateId }
  });
}
