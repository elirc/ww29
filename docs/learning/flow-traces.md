# Flow Traces

## Flow: Create notification batch
1. `src/components/forms/notification-batch-form.tsx` — submit handler builds a `CreateBatchPayload`.
2. `src/hooks/useNotifications.ts` — `createBatch.mutationFn` fires `POST /api/notifications`.
3. `src/app/api/notifications/route.ts` — `POST()` verifies auth and parses `createNotificationBatchSchema`.
4. `src/lib/auth/session.ts` — `requireApiSession()` validates the signed cookie and the `notifications:create` permission.
5. `src/lib/validation/notificationSchemas.ts` — `createNotificationBatchSchema.parse()` validates body shape and cross-field rules.
6. `src/services/notificationService.ts` — `createNotificationBatchForSession()` loads recipients/templates, opens a transaction, renders content, and decides `QUEUED` vs `SKIPPED`.
7. `src/repositories/userRepository.ts` — `findRecipientsByIds()` loads recipients with preferences.
8. `src/repositories/templateRepository.ts` — `findTemplateById()` loads the selected template.
9. `src/repositories/notificationRepository.ts` — `createNotificationBatch()` and `createNotification()` persist batch and notification rows.
10. `src/repositories/deliveryRepository.ts` — `createNotificationDelivery()` persists one delivery row per requested channel.
11. `src/repositories/auditLogRepository.ts` — `createAuditLog()` records `notifications.batch_created`.
12. Returns `{ batch }`.

## Flow: Reject non-admin dashboard access
1. `src/hooks/useAdminDashboard.ts` — query fires `GET /api/admin/dashboard`.
2. `src/app/api/admin/dashboard/route.ts` — `GET()` authenticates the caller.
3. `src/lib/auth/session.ts` — `requireApiSession()` verifies the session cookie.
4. `src/services/monitoringService.ts` — `getAdminDashboard()` calls `requireAction(session.role, "dashboard:view:admin")`.
5. `src/lib/auth/permissions.ts` — `requireAction()` throws `ApiError(403, ...)`.
6. `src/lib/http/api-errors.ts` — `withRouteErrorHandling()` converts the thrown error into a JSON `403`.
7. Returns `{ error }`.

## Flow: Open tracking on a sent notification
1. `src/app/notifications/page.tsx` — "Mark as opened" button calls `notifications.markOpened.mutate(notification.id)`.
2. `src/hooks/useNotifications.ts` — `markOpened.mutationFn` fires `POST /api/notifications/[id]/open`.
3. `src/app/api/notifications/[id]/open/route.ts` — `POST()` authenticates the caller.
4. `src/services/notificationService.ts` — `markNotificationOpenedForSession()` loads the notification, checks ownership, and validates that at least one delivery is `SENT`.
5. `src/repositories/notificationRepository.ts` — `findNotificationDetail()` loads the notification and delivery state.
6. `src/repositories/deliveryRepository.ts` — `markDeliveryOpened()` transitions sent deliveries to `OPENED`.
7. `src/repositories/notificationRepository.ts` — `updateNotificationOpenedAt()`, `getDeliveryStatusesForNotification()`, `updateNotificationStatus()`, `getNotificationStatusesForBatch()`, and `updateBatchStatus()` recompute aggregates.
8. `src/repositories/auditLogRepository.ts` — `createAuditLog()` records `notifications.opened`.
9. Returns `{ opened: true }`.

## Flow: Async worker sends a queued delivery
1. `src/workers/notificationWorker.ts` — the polling loop calls `processDueDeliveries(env.WORKER_ID, 10)`.
2. `src/services/workerService.ts` — `processDueDeliveries()` claims due deliveries.
3. `src/repositories/deliveryRepository.ts` — `claimDueDeliveries()` atomically leases rows with `FOR UPDATE SKIP LOCKED`.
4. `src/services/workerService.ts` — `processSingleDelivery()` resolves the recipient target and rate-limit requirements.
5. `src/repositories/rateLimitRepository.ts` — `reserveRateLimitSlot()` atomically increments the current window or returns a defer time.
6. `src/lib/notifications/channels.ts` — `sendViaChannel()` simulates provider success, permanent rejection, or transient failure.
7. `src/repositories/deliveryRepository.ts` — `markDeliverySent()` or `markDeliveryDeferred()` or `markDeliveryFailed()` persists the outcome.
8. `src/repositories/deliveryRepository.ts` — `createDeliveryAttempt()` stores delivery history.
9. `src/services/notificationService.ts` — `recomputeNotificationState()` refreshes notification and batch rollups.
10. Returns `{ claimed, results }`.

## Flow: Data isolation on notification detail
1. `src/app/api/notifications/[id]/route.ts` — `GET()` authenticates the caller.
2. `src/services/notificationService.ts` — `getNotificationDetailForSession()` loads the detail record.
3. `src/repositories/notificationRepository.ts` — `findNotificationDetail()` returns the notification with recipient ownership.
4. `src/services/notificationService.ts` — `getNotificationDetailForSession()` compares `notification.recipientUserId` against `session.userId` when the actor lacks `notifications:view:any`.
5. `src/lib/http/api-errors.ts` — `withRouteErrorHandling()` serializes the `404` if the notification belongs to someone else.
6. Returns either `{ notification }` or a `404` ownership rejection.

## Line references for the flows above

| Flow step | Location |
|---|---|
| Batch POST route | `src/app/api/notifications/route.ts:38-44` |
| Batch service | `src/services/notificationService.ts:85-243` (transaction 116-238) |
| Dashboard route | `src/app/api/admin/dashboard/route.ts:11-16` |
| Admin check | `src/services/monitoringService.ts:13` |
| Open route | `src/app/api/notifications/[id]/open/route.ts:11-20` |
| Open service | `src/services/notificationService.ts:280-323` |
| Worker loop | `src/workers/notificationWorker.ts:20-31` |
| Claim | `src/repositories/deliveryRepository.ts:13-73` |
| Per-delivery processing | `src/services/workerService.ts:34-129` |
| Detail route | `src/app/api/notifications/[id]/route.ts:11-20` |

## Corrections to the worker flow

- Step 4-5: the rate-limit reservation happens before the send attempt and consumes a slot even if
  the send then fails (`workerService.ts:37-41` precede line 66).
- Step 5: "or returns a defer time" — the function can return one in principle (line 62), but with
  the current `CASE` expression it never does; see `astraupskill/06-SOLUTIONS-AND-REVIEW.md`.
- Step 7-9: these are three or four separate writes with no transaction.

## Flow: Viewer updates preferences

1. `src/app/preferences/page.tsx` renders `src/components/forms/preference-form.tsx`.
2. `src/hooks/usePreferences.ts` sends `PUT /api/preferences`.
3. `src/app/api/preferences/route.ts:22-28` — `requireApiSession(request, "preferences:manage:own")`,
   then `preferenceUpdateSchema.parse()`.
4. `src/lib/validation/preferenceSchemas.ts:17-36` rejects half-set or zero-length quiet hours.
5. `src/services/preferenceService.ts:44-68` — loads the user, upserts the preference, writes an
   audit row with the full input as payload.
6. Returns `{ preferences }`.

Note that preferences affect only deliveries created **after** the change: opt-outs and quiet hours
are applied in `createNotificationBatchForSession` (lines 167-206), and the worker does not re-check
them.

**Exercise — Goal:** trace a seeded quiet-hours user. **Check:** `prisma/seed.ts:84-85` gives
`customer.two@example.com` quiet hours 22 to 6. For a batch created at 23:00 server time, compute
`availableAt` with `getQuietHoursResumeAt` (`notificationService.ts:46-55`): 06:00 the next day.
