# Concepts Demonstrated

## Service layer
Where to look: `src/services/notificationService.ts` — `createNotificationBatchForSession()` owns the workflow and keeps route handlers thin.
Also see: `src/services/preferenceService.ts` for a smaller service with the same layering pattern.
Risk if wrong: Business rules leak into route files and become inconsistent across endpoints.

## Repository pattern
Where to look: `src/repositories/notificationRepository.ts` — `listNotificationsForActor()` and `findNotificationDetail()` own the query shapes.
Also see: `src/repositories/deliveryRepository.ts` for queue-table queries and raw SQL claiming.
Risk if wrong: Prisma access spreads across services and ownership filters get missed.

## Zod validation boundary
Where to look: `src/lib/validation/notificationSchemas.ts` — `createNotificationBatchSchema` validates complex write input before service code runs.
Also see: `src/lib/validation/preferenceSchemas.ts` for cross-field validation using `superRefine()`.
Risk if wrong: Invalid requests can create partial queue state or impossible scheduling inputs.

## Auth/session flow
Where to look: `src/lib/auth/session.ts` — `createSessionToken()`, `getSessionFromRequest()`, and `requireApiSession()` define the trusted session path.
Also see: `src/app/api/auth/login/route.ts` for where the signed cookie is issued.
Risk if wrong: Callers can impersonate other users or protected routes can run without a verified session.

## Role-based access control
Where to look: `src/lib/auth/permissions.ts` — `rolePermissions` and `requireAction()` define every role check.
Also see: `src/services/monitoringService.ts` for an admin-only example.
Risk if wrong: One missed route can become a privilege escalation path.

## Ownership-based data isolation
Where to look: `src/repositories/notificationRepository.ts` — `listNotificationsForActor()` scopes viewer queries to `recipientUserId`.
Also see: `src/services/notificationService.ts` — `getNotificationDetailForSession()` rejects cross-user detail fetches.
Risk if wrong: Users can read or mutate another user's notification history.

## Status and state transitions
Where to look: `src/services/notificationService.ts` — `markNotificationOpenedForSession()` enforces that only sent deliveries can transition to opened.
Also see: `src/repositories/notificationRepository.ts` — `deriveNotificationStatus()` and `deriveBatchStatus()` roll up child state into parent state.
Risk if wrong: Dashboards and downstream workflows will trust invalid state.

## Background job design
Where to look: `src/services/workerService.ts` — `processDueDeliveries()` and `processSingleDelivery()` implement async processing outside the web request.
Also see: `src/workers/notificationWorker.ts` for the separate worker loop and `src/repositories/deliveryRepository.ts` for row claiming.
Risk if wrong: Deliveries can be lost, duplicated, or retried incorrectly.

## Atomic queue claiming
Where to look: `src/repositories/deliveryRepository.ts` — `claimDueDeliveries()` uses one SQL statement with `FOR UPDATE SKIP LOCKED`.
Also see: `prisma/schema.prisma` — `NotificationDelivery.lockedAt` and `lockedBy` fields support lease tracking.
Risk if wrong: Multiple workers can process the same delivery at once.

## Per-user/channel rate limiting
Where to look: `src/repositories/rateLimitRepository.ts` — `reserveRateLimitSlot()` uses an atomic upsert.
Also see: `src/services/workerService.ts` for how rate-limit failures become deferred queue state.
Risk if wrong: The platform will burst over its own throttling guarantees under concurrency.

## Audit logging
Where to look: `src/repositories/auditLogRepository.ts` — `createAuditLog()` records durable action history.
Also see: `src/services/notificationService.ts` and `src/services/preferenceService.ts` for where business actions emit logs.
Risk if wrong: Operators lose a trustworthy trail for security and operational review.

## Multi-tenancy exclusion
Where to look: `docs/architecture/auth-and-permissions.md` — the "Why multi-tenancy is not included" section explains the deliberate single-tenant choice and the files that would change later.
Also see: `src/repositories/notificationRepository.ts` for the current user-scoped isolation boundary.
Risk if wrong: Teams may assume tenant isolation exists when the current implementation only provides user/role isolation.
