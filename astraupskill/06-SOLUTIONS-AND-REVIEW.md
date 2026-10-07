# Separate solutions and review rubric

## Solutions

**Level 1.** 404 "Notification not found." from `notificationService.ts:294-295`. No write: the
service returns before line 298. A 404 rather than 403 keeps the existence of the id private.

**Level 2.** 409 "Only sent notifications can transition to opened." from line 303. No status
refresh and no audit.

**Level 3.** `markDeliveryOpened(['delivery-1'])` (ids from the `SENT` filter at 298-300);
`updateNotificationOpenedAt('notification-1')` (id from the loaded detail); notification status
`COMPLETED` (fixture returns `[{status:'OPENED'}]`, which reaches line 239); batch status
`COMPLETED` (fixture returns `[{status:'COMPLETED'}]`, line 266); audit `notifications.opened` with
`entityId: notification.id`.

**Level 4.** Only the recipient branch changes: `can(role, "notifications:view:any")` is true for
both ADMIN and OPERATOR, so an operator also succeeds. The `SENT` check and the write sequence are
identical.

**Level 5.**
(a) `COMPLETED` at line 239 — `SKIPPED` is in `completedStatuses`, and that check runs first.
(b) `QUEUED` at line 255-257 — not all completed, not all failed, `hasFailed` is false, no
`PROCESSING`. A notification that has already been partly delivered reads as `QUEUED`.
(c) `QUEUED` at line 284-286 — neither "all" branch matches, and the partial branch needs at least one
`COMPLETED`. A batch where every notification partly failed is reported as queued.
(d) `QUEUED` — no `PROCESSING` present.

**Level 6.** Today a repeat returns 409 because no delivery is `SENT`. A reasonable idempotent
design: if all eligible deliveries are already `OPENED`, return `{ opened: true }` without writes,
keep the first `openedAt` (use `updateMany where openedAt IS NULL`), and do not write a second
audit row. Tests: first open, second open, open with one `OPENED` and one newly `SENT` delivery.

**Level 7.** The provider has accepted the message but the row stays `PROCESSING` with `lockedAt`
set. `claimDueDeliveries` only selects `QUEUED`, `RETRYING` and `RATE_LIMITED`
(`deliveryRepository.ts:22-26`), so the `lockedAt < staleBefore` clause on line 28 never applies to
a `PROCESSING` row. The delivery is stranded: not re-sent (no duplicate), but never marked `SENT`
either. It shows up only in the dashboard's stale count.

**Level 8.** Calls 1-5 return `sentCount` 1, 2, 3, 4, 5 — all allowed. Call 6: the `CASE` at
lines 49-52 leaves `sentCount` at 5 because `5 < 5` is false, so it returns 5, and line 61 computes
`allowed: 5 <= 5`, which is **true**. Every later call also returns 5 and is allowed. The limiter
never denies.

## Review rubric for the open path

- Ownership, lifecycle, aggregation and audit are each owned by an identifiable line.
- Privacy errors are indistinguishable from not-found.
- Tests run the real service and real policy functions; reject tests that only call
  `markDeliveryOpened` or copy the role predicate.
- Any change that adds a transaction must also say what happens to the audit write.
- Ask whether `SKIPPED` counting as completed is intended product policy.

## Senior-review findings (whole codebase)

1. **Rate limiter never denies** — `src/repositories/rateLimitRepository.ts:49-61`. When the window
   is full the `CASE` keeps `sentCount` equal to `limit`, and `allowed` is computed as
   `sentCount <= limit`. The `RATE_LIMITED` branch in `workerService.ts:43-63` is unreachable. Fix:
   return a flag from SQL (for example `RETURNING ("sentCount" < limit) OR inserted`) or increment
   unconditionally and compare with `<=`.
2. **Crashed workers strand deliveries in `PROCESSING`** — `deliveryRepository.ts:22-28`. The stale
   lease condition is inside a `WHERE` that excludes `PROCESSING`, so a lease is never reclaimed.
   Fix: include `PROCESSING` rows whose `lockedAt` is stale, and accept at-least-once semantics.
2a. **Transient failures retry forever** — `markDeliveryDeferred` (`deliveryRepository.ts:115-132`)
   does not increment `attemptCount`, so `nextAttemptCount` at `workerService.ts:94` is always 1,
   `exhausted` never becomes true, and the backoff stays at one minute (`workerService.ts:23-25`).
   The `MAX_ATTEMPTS_EXCEEDED` branch is unreachable for transient errors. Fix: increment
   `attemptCount` in the deferral write for `RETRYING` (not for `RATE_LIMITED`).
3. **Batch roll-up mislabels all-partial batches** — `notificationRepository.ts:273-286`, see Level 5c.
   Partial delivery also regresses a notification to `QUEUED` (Level 5b).
4. **Staff can generate opens for customers** — `notificationService.ts:292-296` lets
   `notifications:view:any` bypass recipient ownership on a write named `open:own`.
5. **No transaction around open** — `notificationService.ts:306-318`; lab case 6 demonstrates partial
   progress. Each open also overwrites `openedAt` (`notificationRepository.ts:154`).
6. **Worker outcome writes are not atomic** — `workerService.ts:73-85`: `markDeliverySent`,
   `createDeliveryAttempt` and `recomputeNotificationState` are three separate statements; a failure
   in the second leaves a `SENT` delivery with no attempt row.
7. **Quiet hours are evaluated once, in server local time** — `rendering.ts:60` uses `getHours()`
   of the server clock, and only `createNotificationBatchForSession` calls `isWithinQuietHours`
   (`notificationService.ts:201`); a retry scheduled into quiet hours is sent anyway. The file header
   says the worker calls it; the worker imports only `resolveChannelTarget` (`workerService.ts:11`).
8. **Recipient directory exposed to every role** — `GET /api/notifications` always returns
   `getNotificationComposerData()` (`src/app/api/notifications/route.ts:26-28`), which includes every
   user's name, email and role (`userRepository.ts` `listRecipientDirectory`), even for a `VIEWER`.
9. **Unvalidated status filter** — `notificationQuerySchema.status` is any string
   (`notificationSchemas.ts:17`) and is cast to the enum in `notificationRepository.ts:71`; an
   unknown value reaches Prisma, which rejects it, and the route returns a generic 500.
10. **Sessions cannot be revoked and roles are frozen for 7 days** — the role is inside the JWT
    (`session.ts:28-37`) and never re-read; logout only clears the cookie (`logout/route.ts:18`).
11. **Duplicate recipient ids produce a misleading 404** — `findRecipientsByIds` returns distinct
    users, so `[a, a]` fails the length check at `notificationService.ts:107` with
    "One or more recipients were not found."
12. **Test blind spots** — no tests for the worker, the claim SQL, the rate-limit SQL, batch creation,
    or login.
