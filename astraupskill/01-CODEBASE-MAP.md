# Codebase map

## Layers

| Layer | Files | Notes |
|---|---|---|
| Route handlers | `src/app/api/**/route.ts` | Each wraps its body in `withRouteErrorHandling` (`src/lib/http/api-errors.ts:17-56`) |
| Session | `src/lib/auth/session.ts` | HS256 JWT in an `HttpOnly; SameSite=Lax` cookie named `notification_session` (lines 14, 100-102) |
| RBAC | `src/lib/auth/permissions.ts` | One matrix `rolePermissions` (lines 19-40), `can` (42-44), `requireAction` (46-51) |
| Validation | `src/lib/validation/*.ts` | Zod 4 schemas, including cross-field `superRefine` rules |
| Services | `src/services/*.ts` | Workflow and policy |
| Repositories | `src/repositories/*.ts` | All Prisma access, including two raw-SQL statements |
| Worker | `src/workers/notificationWorker.ts` -> `src/services/workerService.ts` | Polls every 1 s when busy, 5 s when idle (`notificationWorker.ts:30`) |
| DB client | `src/lib/db.ts` | `PrismaClient` with the `PrismaPg` adapter over a `pg.Pool`, cached on `global` outside production |

`src/lib/env.ts:9-13` parses `DATABASE_URL`, `SESSION_SECRET` (min 16 chars) and `WORKER_ID` at
import time, so any module that imports `env` throws on load if those are missing.
`tests/setup.ts` supplies defaults for the Vitest suite.

## Walkthrough: `POST /api/notifications/[id]/open`

1. `src/app/api/notifications/[id]/open/route.ts:16` calls
   `requireApiSession(request, "notifications:open:own")`.
   - `getSessionFromRequest` (`session.ts:75-83`) reads the cookie with `readCookieValue` (lines 62-73)
     and verifies it with `jwtVerify` (lines 40-60). Any verification error returns `null`.
   - No session -> `ApiError(401, "Authentication required.")` (lines 89-91).
   - Then `requireAction(session.role, action)` (line 94). All three roles have
     `notifications:open:own` (`permissions.ts:24, 32, 37`), so this check never rejects today.
2. Line 18 calls `markNotificationOpenedForSession(session, id)`.
3. In the service (`notificationService.ts:280-323`):
   - line 284 repeats `requireAction(... "notifications:open:own")`;
   - line 286 loads the notification with recipient, batch and deliveries (`findNotificationDetail`,
     `notificationRepository.ts:104-134`);
   - lines 288-290: missing -> 404;
   - lines 292-296: unless the role has `notifications:view:any` (ADMIN, OPERATOR), a non-recipient
     also gets 404 with the same message — no existence leak;
   - lines 298-304: collect delivery ids whose status is `SENT`; none -> 409;
   - line 306 `markDeliveryOpened(ids)` — an `updateMany` that re-checks `status: SENT` in its
     `where` clause (`deliveryRepository.ts:155-168`);
   - line 307 `updateNotificationOpenedAt` — overwrites `openedAt` with "now" every time
     (`notificationRepository.ts:147-157`);
   - line 308 `refreshNotificationAndBatchState` (lines 57-71): re-reads delivery statuses, derives and
     writes the notification status, re-reads all sibling notification statuses, derives and writes the
     batch status;
   - lines 310-318 write an `AuditLog` row with `action: "notifications.opened"` and the opened ids;
   - line 320 returns `{ opened: true }`.
4. `withRouteErrorHandling` serializes the object as JSON 200, an `ApiError` as `{ error, details }`
   with its status, a `ZodError` as 400, anything else as 500 (`api-errors.ts:20-55`).

None of the writes in step 3 share a transaction. Contrast batch creation, which wraps everything in
`prisma.$transaction` (`notificationService.ts:116-238`).

## Where the other moving parts live

- Batch creation fan-out: `createNotificationBatchForSession` (`notificationService.ts:85-243`).
  One `Notification` per recipient, one `NotificationDelivery` per requested channel, each
  `QUEUED` or `SKIPPED`.
- Worker claim: `claimDueDeliveries` (`deliveryRepository.ts:13-73`) — CTE with
  `FOR UPDATE SKIP LOCKED`, then `UPDATE ... SET status = 'PROCESSING'`.
- Worker outcome handling: `processSingleDelivery` (`workerService.ts:34-129`).
- Rate limit: `reserveRateLimitSlot` (`rateLimitRepository.ts:33-64`).
- Status roll-ups: `deriveNotificationStatus` / `deriveBatchStatus`
  (`notificationRepository.ts:217-287`).

## Exercise

**Goal:** Map side effects in the open path.
**Check:** List every line in `notificationService.ts:280-323` that writes to the database. Expected:
306, 307, 308 (two writes inside `refreshNotificationAndBatchState`, at lines 63 and 70), and 310.
Then state which of those writes would remain committed if the write at line 70 threw (expected:
306, 307, 63).
