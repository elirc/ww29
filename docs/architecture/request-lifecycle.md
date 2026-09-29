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
