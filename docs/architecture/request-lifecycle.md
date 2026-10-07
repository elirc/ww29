# Request Lifecycle

Request: Operator creates a notification batch
1. `src/app/api/notifications/route.ts` — `POST()` reads the cookie with `requireApiSession(request, "notifications:create")` and validates the body with `createNotificationBatchSchema.parse()`.
2. `src/services/notificationService.ts` — `createNotificationBatchForSession()` checks template/channel rules, loads recipients, and starts a transaction.
3. `src/repositories/userRepository.ts` — `findRecipientsByIds()` resolves the requested recipients with preferences included.
4. `src/repositories/templateRepository.ts` — `findTemplateById()` loads the selected template when one is provided.
5. `src/lib/notifications/rendering.ts` — `buildMessageValues()`, `renderTemplate()`, `isChannelOptedIn()`, and `isWithinQuietHours()` shape each delivery candidate.
6. `src/repositories/notificationRepository.ts` — `createNotificationBatch()` and `createNotification()` persist the batch and recipient-level notifications.
7. `src/repositories/deliveryRepository.ts` — `createNotificationDelivery()` creates one delivery row per recipient/channel with `QUEUED` or `SKIPPED`.
8. `src/repositories/auditLogRepository.ts` — `createAuditLog()` records the batch creation event.
9. Returns `200` with `{ batch }`.

Request: Viewer loads their notification history
1. `src/app/api/notifications/route.ts` — `GET()` verifies auth with `requireApiSession(request, "notifications:view:own")` and parses query params with `notificationQuerySchema`.
2. `src/services/notificationService.ts` — `listNotificationsForSession()` decides whether the actor should be scoped to self.
3. `src/repositories/notificationRepository.ts` — `listNotificationsForActor()` applies the ownership filter in the Prisma query.
4. `src/services/notificationService.ts` — `getNotificationComposerData()` also loads templates and recipients for operator/admin UI state.
5. `src/repositories/templateRepository.ts` — `listTemplates()` loads available templates.
6. `src/repositories/userRepository.ts` — `listRecipientDirectory()` loads recipient choices.
7. Returns `200` with `{ notifications, composer }`.

Request: Admin loads the monitoring dashboard
1. `src/app/api/admin/dashboard/route.ts` — `GET()` verifies the session with `requireApiSession(request)`.
2. `src/services/monitoringService.ts` — `getAdminDashboard()` calls `requireAction(session.role, "dashboard:view:admin")`.
3. `src/repositories/dashboardRepository.ts` — `getDashboardSnapshot()` fans out to metric queries.
4. `src/repositories/deliveryRepository.ts` — `countDeliveriesByStatus()`, `countStaleProcessingDeliveries()`, and `listRecentFailedDeliveries()` read queue health.
5. `src/repositories/notificationRepository.ts` — `countBatchesByStatus()` and `listRecentBatches()` read batch-level rollups.
6. Returns `200` with `{ deliveryCounts, batchCounts, staleProcessingCount, recentFailures, recentBatches }`.

Request: Viewer marks a sent notification as opened
1. `src/app/api/notifications/[id]/open/route.ts` — `POST()` verifies auth with `requireApiSession(request, "notifications:open:own")`.
2. `src/services/notificationService.ts` — `markNotificationOpenedForSession()` loads the notification, checks ownership, and rejects invalid transitions when no delivery is in `SENT`.
3. `src/repositories/notificationRepository.ts` — `findNotificationDetail()` returns the notification plus delivery state.
4. `src/repositories/deliveryRepository.ts` — `markDeliveryOpened()` transitions sent deliveries to `OPENED`.
5. `src/repositories/notificationRepository.ts` — `updateNotificationOpenedAt()`, `getDeliveryStatusesForNotification()`, `updateNotificationStatus()`, `getNotificationStatusesForBatch()`, and `updateBatchStatus()` recompute aggregates.
6. `src/repositories/auditLogRepository.ts` — `createAuditLog()` records the engagement event.
7. Returns `200` with `{ opened: true }`.

Request: Operator tries to load the admin dashboard and is rejected
1. `src/app/api/admin/dashboard/route.ts` — `GET()` verifies the session and forwards the request to the monitoring service.
2. `src/services/monitoringService.ts` — `getAdminDashboard()` calls `requireAction(session.role, "dashboard:view:admin")`.
3. `src/lib/auth/permissions.ts` — `requireAction()` throws `ApiError(403, ...)`.
4. `src/lib/http/api-errors.ts` — `withRouteErrorHandling()` catches the `ApiError` and serializes the failure.
5. Returns `403` with `{ error: "You do not have permission to perform this action." }`.
   (`withRouteErrorHandling` also includes `details: null`, `src/lib/http/api-errors.ts:28-34`.)

## Corrections and precision

- **Batch creation, step 2.** The template/channel rule (`notificationService.ts:91-96`) and the
  recipient lookup (lines 102-109) run **before** the transaction starts at line 116; recipients and
  template are loaded in parallel with `Promise.all`.
- **Batch creation, step 5.** Quiet hours only delay `availableAt` for `QUEUED` deliveries
  (lines 201-206); opt-outs and missing destinations become `SKIPPED` first (lines 169-199).
- **History, step 4.** Composer data is loaded for **every** caller, including viewers
  (`src/app/api/notifications/route.ts:26-28`), not only operator/admin UI.
- **Open, step 2.** Ownership is bypassed for roles with `notifications:view:any`, so ADMIN and
  OPERATOR can open other users' notifications.

## Request: Worker processes one claimed delivery (not HTTP, but the same layering)

1. `src/workers/notificationWorker.ts:21` calls `processDueDeliveries(env.WORKER_ID, 10)`.
2. `src/services/workerService.ts:132` claims up to ten rows (`claimDueDeliveries`).
3. Each row is processed sequentially (`workerService.ts:143-146`).
4. `processSingleDelivery` resolves the destination (line 36) and reserves a rate-limit slot
   (lines 37-41).
5. `sendViaChannel` (`src/lib/notifications/channels.ts:23-48`) throws `ApiError(422)` for a missing
   destination or a `[[permanent-failure]]` body, a plain `Error` for `[[transient-failure]]`, and
   otherwise returns a random message id.
6. Success -> `markDeliverySent`, attempt `SENT`, recompute. Failure -> `FAILED` if the error is a 4xx
   `ApiError` or attempts are exhausted (`maxAttempts` defaults to 3), else `RETRYING` with a delay of
   1, 5 or 15 minutes (`workerService.ts:22-32`).

**Exercise — Goal:** predict a retry schedule from the code, not from the intent. **Check:** for a
delivery whose body contains `[[transient-failure]]`, list `status`, `attemptCount` and the delay
after each of three worker passes. The design intent is 1, 5, then 15 minutes and a final `FAILED`
with `MAX_ATTEMPTS_EXCEEDED`. The code gives `RETRYING`, `attemptCount` 0, delay 1 minute — on
every pass, forever. Explain why using these lines: `markDeliveryDeferred` never increments
`attemptCount` (`deliveryRepository.ts:115-132`), so `nextAttemptCount` (`workerService.ts:94`) is
always 1, `exhausted` (line 95) is never true with `maxAttempts` 3, and `getRetryDelayMinutes(1)`
returns 1 (lines 23-25). Each pass also writes a `DeliveryAttempt` with `attemptNumber` 1.
