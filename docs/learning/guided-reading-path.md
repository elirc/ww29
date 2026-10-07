# Guided Reading Path

## Step 1 — src/app/api/notifications/route.ts
**Why read this:** It shows the house style for request handlers in this codebase.
**What to look for:** `requireApiSession()` and `createNotificationBatchSchema.parse()` happen before service calls.
**What to trace:** Called by `src/hooks/useNotifications.ts`; calls `src/services/notificationService.ts`.
**What a junior would likely miss:** The route never talks to Prisma directly.

## Step 2 — src/lib/auth/session.ts
**Why read this:** This file explains how auth enters the backend.
**What to look for:** `getSessionFromRequest()` parses cookies and `requireApiSession()` turns missing auth into `401`.
**What to trace:** Called by `src/app/api/auth/me/route.ts`, `src/app/api/notifications/route.ts`, and `src/app/api/admin/dashboard/route.ts`; calls `src/lib/auth/permissions.ts`.
**What a junior would likely miss:** Signed server cookies are the trust boundary, not client state.

## Step 3 — src/lib/auth/permissions.ts
**Why read this:** It centralizes RBAC in one reviewable matrix.
**What to look for:** `rolePermissions`, `can()`, and `requireAction()`.
**What to trace:** Called by `src/lib/auth/session.ts`, `src/services/notificationService.ts`, and `src/services/monitoringService.ts`; calls `src/lib/http/api-errors.ts`.
**What a junior would likely miss:** Repeating role checks inline is a maintenance and security smell.

## Step 4 — src/lib/validation/notificationSchemas.ts
**Why read this:** It shows the API boundary for the most complex write in the app.
**What to look for:** The `superRefine()` block that enforces template/body and email subject rules.
**What to trace:** Called by `src/app/api/notifications/route.ts`; calls only Zod.
**What a junior would likely miss:** Cross-field rules belong here, not buried in a service after partial writes have started.

## Step 5 — src/services/notificationService.ts
**Why read this:** This is the main business-logic orchestrator.
**What to look for:** `createNotificationBatchForSession()`, `markNotificationOpenedForSession()`, and `refreshNotificationAndBatchState()`.
**What to trace:** Called by `src/app/api/notifications/route.ts` and `src/app/api/notifications/[id]/open/route.ts`; calls repositories, template utilities, and audit logging.
**What a junior would likely miss:** The transaction boundary wraps the entire batch fan-out.

## Step 6 — src/repositories/notificationRepository.ts
**Why read this:** It shows how aggregate status and ownership scoping are encoded at the database layer.
**What to look for:** `listNotificationsForActor()`, `deriveNotificationStatus()`, and `deriveBatchStatus()`.
**What to trace:** Called by `src/services/notificationService.ts` and `src/services/monitoringService.ts`; calls Prisma.
**What a junior would likely miss:** Ownership filtering belongs inside the repository query, not only in the caller.

## Step 7 — src/repositories/deliveryRepository.ts
**Why read this:** This file is the durable queue implementation.
**What to look for:** `claimDueDeliveries()` and the `FOR UPDATE SKIP LOCKED` claim statement.
**What to trace:** Called by `src/services/workerService.ts` and `src/services/notificationService.ts`; calls Prisma and Postgres SQL.
**What a junior would likely miss:** Claiming work and marking it `PROCESSING` must be atomic.

## Step 8 — src/repositories/rateLimitRepository.ts
**Why read this:** It demonstrates a safe atomic rate-limit increment.
**What to look for:** `reserveRateLimitSlot()` and the `ON CONFLICT ... DO UPDATE` statement.
**What to trace:** Called by `src/services/workerService.ts`; calls Prisma raw SQL.
**What a junior would likely miss:** Read-then-write rate limits leak under concurrent workers.

## Step 9 — src/services/workerService.ts
**Why read this:** This file is the async reliability layer.
**What to look for:** `processDueDeliveries()` and `processSingleDelivery()`.
**What to trace:** Called by `src/workers/notificationWorker.ts`; calls `src/repositories/deliveryRepository.ts`, `src/repositories/rateLimitRepository.ts`, and `src/lib/notifications/channels.ts`.
**What a junior would likely miss:** Retry scheduling, final failure, and rate-limit deferral are different states.

## Step 10 — src/workers/notificationWorker.ts
**Why read this:** It shows how async work is kept out of the request lifecycle.
**What to look for:** The polling loop and how it calls `processDueDeliveries()`.
**What to trace:** Called by `npm run worker`; calls `src/services/workerService.ts`.
**What a junior would likely miss:** HTTP handlers are not a reliable place to finish background delivery.

## Step 11 — src/services/preferenceService.ts
**Why read this:** It shows a smaller service that still logs writes and validates ownership.
**What to look for:** `getMyPreferences()` and `updateMyPreferences()`.
**What to trace:** Called by `src/app/api/preferences/route.ts`; calls `src/repositories/preferenceRepository.ts`, `src/repositories/userRepository.ts`, and `src/repositories/auditLogRepository.ts`.
**What a junior would likely miss:** Preference writes are compliance-relevant, not just UI settings.

## Step 12 — prisma/schema.prisma
**Why read this:** It is the durable model behind all the workflows.
**What to look for:** Separate `Notification`, `NotificationDelivery`, and `DeliveryAttempt` models plus queue lock fields on `NotificationDelivery`.
**What to trace:** Used by every repository through Prisma Client and by `prisma/seed.ts`.
**What a junior would likely miss:** Retryable systems need attempt history and lease metadata in the schema, not just status enums.

## Checkpoints

Each Check is something you can confirm by reading the cited code.

- **After Step 2.** **Goal:** know what is in the token. **Check:** list the four claims signed at
  `src/lib/auth/session.ts:28-33` and the cookie attributes at line 101.
- **After Step 3.** **Goal:** read the matrix. **Check:** state which actions OPERATOR lacks compared
  with ADMIN (only `dashboard:view:admin`, `permissions.ts:20-34`).
- **After Step 4.** **Goal:** see the cross-field rules. **Check:** name the two `superRefine` issues
  in `notificationSchemas.ts:39-54` and say why neither rejects duplicate entries in `channels`.
- **After Step 5.** **Goal:** see what is inside and outside the transaction. **Check:** confirm the
  template/channel check (lines 91-96) and recipient lookup (102-109) run before `$transaction` at
  line 116, and that `markNotificationOpenedForSession` uses no transaction at all.
- **After Step 6.** **Goal:** run the roll-up by hand. **Check:** derive the batch status for
  `[PARTIAL_FAILURE, PARTIAL_FAILURE]` from `deriveBatchStatus` (it returns `QUEUED`).
- **After Step 7.** **Goal:** read the claim SQL critically. **Check:** explain why the
  `"lockedAt" < staleBefore` clause (line 28) can never select a `PROCESSING` row.
- **After Step 8.** **Goal:** simulate the limiter. **Check:** compute `allowed` for the sixth EMAIL
  reservation in one hour (`limit` 5, lines 49-61) — it is `true`.
- **After Step 9.** **Goal:** simulate backoff. **Check:** explain why the retry delay stays at one
  minute for transient failures (lines 22-32 and 94, plus `markDeliveryDeferred`).

## Optional Step 13 — `tests/runtime-notification-open-lab.test.mjs`

**Why read this:** It runs the real open service against recording doubles.
**What to look for:** The `calls` arrays and the sequence asserted at line 69.
**What a junior would likely miss:** It is a `node:test` file, run with
`node --experimental-vm-modules --test`, separate from the Vitest suite.
