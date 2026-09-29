/*
 * This file owns the per-user, per-channel rate-limit counters used by the worker.
 * It is called by `src/services/workerService.ts` right before a delivery is sent.
 * It calls Prisma raw SQL so the increment stays atomic under concurrent workers.
 * A junior engineer often implements rate limits with read-then-write logic, which creates race conditions and lets bursts leak through.
 */
import { NotificationChannel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

const WINDOW_MINUTES = 60;

function startOfWindow(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0
    )
  );
}

function nextWindow(date: Date) {
  const next = startOfWindow(date);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export async function reserveRateLimitSlot(input: {
  userId: string;
  channel: NotificationChannel;
  limit: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const windowStart = startOfWindow(now);

  // ⚠️ SENIOR NOTE: This atomic upsert prevents two workers from both "seeing room" and sending the same user over the per-window limit.
  const rows = await prisma.$queryRaw<{ sentCount: number }[]>(
    Prisma.sql`
      INSERT INTO "RateLimitWindow" ("id", "userId", "channel", "windowStart", "sentCount", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${input.userId}, ${input.channel}::"NotificationChannel", ${windowStart}, 1, NOW(), NOW())
      ON CONFLICT ("userId", "channel", "windowStart")
      DO UPDATE
      SET "sentCount" = CASE
        WHEN "RateLimitWindow"."sentCount" < ${input.limit} THEN "RateLimitWindow"."sentCount" + 1
        ELSE "RateLimitWindow"."sentCount"
      END,
      "updatedAt" = NOW()
      RETURNING "sentCount"
    `
  );

  const sentCount = rows[0]?.sentCount ?? input.limit;

  return {
    allowed: sentCount <= input.limit,
    nextAvailableAt: sentCount <= input.limit ? null : nextWindow(now)
  };
}

export function getChannelLimit(channel: NotificationChannel) {
  // ⚠️ SENIOR NOTE: Channel-specific limits live in code for now, but isolating them here makes it straightforward to move them into tenant or environment config later.
  switch (channel) {
    case NotificationChannel.EMAIL:
      return 5;
    case NotificationChannel.SMS:
      return 3;
    case NotificationChannel.PUSH:
      return 10;
  }
}

export { WINDOW_MINUTES };
