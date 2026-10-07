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

## How well each concept is actually implemented

| Concept | Demonstrated well | Gap in this clone |
|---|---|---|
| Zod validation boundary | `superRefine` rules in `notificationSchemas.ts:39-54`, `preferenceSchemas.ts:17-36` | `status` query param is any string (`notificationSchemas.ts:17`) and becomes a 500 on bad input |
| Ownership isolation | Repository scoping at `notificationRepository.ts:66-70` | Staff roles can **open** other users' notifications (`notificationService.ts:292-296`) |
| State transitions | `SENT` precondition plus SQL predicate (`deliveryRepository.ts:161`) | No transaction around the open writes; roll-up mislabels all-partial batches |
| Background jobs | Separate worker process, sequential processing | Transient failures retry forever; crashed claims are never reclaimed |
| Atomic queue claiming | Single CTE + `UPDATE ... RETURNING` with `SKIP LOCKED` | Stale-lease clause unreachable for `PROCESSING` rows |
| Rate limiting | Atomic upsert, no read-then-write | Return value interpreted so the limit never denies |
| Audit logging | Batch creation audits inside the transaction (`notificationService.ts:222-235`) | Open audit can be lost if an earlier write fails |
| Quiet hours | Wrap-around ranges handled (`rendering.ts:62-66`) | Server-local hours; evaluated only at batch creation |

## Exercise

**Goal:** Turn a gap into a reviewable change.
**Check:** Pick one row and write the smallest diff (in prose) that closes the gap, naming the exact
line you would change. For rate limiting, for example: change line 61 of
`rateLimitRepository.ts` so a full window is detected — one option is to make the `CASE` set
`sentCount` to `limit + 1` when full, so `sentCount <= limit` becomes false.
