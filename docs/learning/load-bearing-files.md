# Load-Bearing Files

## src/services/notificationService.ts
- What it does: Owns batch creation, notification reads, open tracking, and aggregate recomputation.
- What calls it: `src/app/api/notifications/route.ts`, `src/app/api/notifications/[id]/route.ts`, `src/app/api/notifications/[id]/open/route.ts`.
- What it calls: `src/repositories/notificationRepository.ts`, `src/repositories/deliveryRepository.ts`, `src/repositories/userRepository.ts`, `src/repositories/templateRepository.ts`, `src/repositories/auditLogRepository.ts`, `src/lib/notifications/rendering.ts`.
- What would break or become insecure if this file were wrong: You could create partial batches, leak other users' notifications, or allow invalid state transitions like opening failed deliveries.
- What a junior engineer would likely miswrite here: Doing notification writes outside a transaction or moving ownership checks into the UI.

## src/services/workerService.ts
- What it does: Claims queued deliveries, applies rate limits, sends via channel adapters, schedules retries, and records final failures.
- What calls it: `src/workers/notificationWorker.ts`.
- What it calls: `src/repositories/deliveryRepository.ts`, `src/repositories/rateLimitRepository.ts`, `src/lib/notifications/channels.ts`, `src/services/notificationService.ts`.
- What would break or become insecure if this file were wrong: Deliveries could be duplicated, retried forever, or marked successful without a persisted attempt trail.
- What a junior engineer would likely miswrite here: Treating retry, rate-limit deferral, and permanent failure as one generic catch block.

## src/repositories/deliveryRepository.ts
- What it does: Implements the queue-table claim/update operations and delivery status persistence.
- What calls it: `src/services/workerService.ts`, `src/services/notificationService.ts`, `src/repositories/dashboardRepository.ts`.
- What it calls: Prisma and Postgres SQL through `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Concurrent workers could pick the same delivery or stale processing rows could never recover.
- What a junior engineer would likely miswrite here: Splitting claim and status update into separate operations.

## src/repositories/notificationRepository.ts
- What it does: Owns notification reads/writes, batch reads/writes, and aggregate status derivation.
- What calls it: `src/services/notificationService.ts`, `src/repositories/dashboardRepository.ts`.
- What it calls: Prisma through `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Viewer users could see someone else’s data or batch/notification status could drift from delivery reality.
- What a junior engineer would likely miswrite here: Applying ownership checks in service code only and forgetting to scope the actual query.

## src/lib/auth/session.ts
- What it does: Signs session cookies, verifies them on requests, and turns missing auth into API errors.
- What calls it: `src/app/api/auth/login/route.ts`, `src/app/api/auth/me/route.ts`, and protected API routes under `src/app/api/`.
- What it calls: `src/lib/env.ts`, `jose`, `src/lib/auth/permissions.ts`, `src/lib/http/api-errors.ts`.
- What would break or become insecure if this file were wrong: Attackers could forge sessions or protected routes could accidentally run without an authenticated user.
- What a junior engineer would likely miswrite here: Trusting client-provided role data instead of signed server-generated cookies.

## src/lib/auth/permissions.ts
- What it does: Defines the RBAC matrix and the helper every permission check flows through.
- What calls it: `src/lib/auth/session.ts`, `src/services/notificationService.ts`, `src/services/monitoringService.ts`.
- What it calls: `src/lib/http/api-errors.ts`.
- What would break or become insecure if this file were wrong: Role enforcement would become inconsistent across routes.
- What a junior engineer would likely miswrite here: Adding a new route-specific role check without updating the central permission model.

## src/repositories/rateLimitRepository.ts
- What it does: Atomically enforces per-user/per-channel rate limits with a Postgres upsert.
- What calls it: `src/services/workerService.ts`.
- What it calls: Prisma raw SQL through `src/lib/db.ts`.
- What would break or become insecure if this file were wrong: Bursts would leak through under concurrent workers and the delivery platform would violate its own throttling guarantees.
- What a junior engineer would likely miswrite here: Reading the current count first and incrementing in a second statement.

## prisma/schema.prisma
- What it does: Defines the durable entities, relationships, enums, and queue metadata.
- What calls it: Prisma Client generation via `npx prisma generate`; consumed indirectly by all repository files and by `prisma/seed.ts`.
- What it calls: Nothing at runtime; it is the schema source of truth.
- What would break or become insecure if this file were wrong: The app could not model retries, delivery history, or state isolation correctly.
- What a junior engineer would likely miswrite here: Keeping only one notification row without per-channel delivery fan-out or attempt history.

## Where the load-bearing files currently fall short

The "what would break" bullets above describe risks. For three of these files the risk is already
realised in this clone:

- `src/repositories/rateLimitRepository.ts:49-61` — the upsert is atomic, but its return value is
  interpreted so that a full window still reports `allowed: true`. Bursts are not limited at all.
- `src/repositories/deliveryRepository.ts:22-28` — "stale processing rows could never recover" is
  exactly what happens: the stale-lease clause cannot match a `PROCESSING` row because the status
  filter excludes it.
- `src/services/workerService.ts:94-95` together with `deliveryRepository.ts:115-132` — deliveries
  are "retried forever" for transient failures because the deferral write does not increment
  `attemptCount`.

## Load-bearing lines (quick index)

| File | Line(s) | Why |
|---|---|---|
| `src/lib/auth/permissions.ts` | 19-40 | The entire role matrix |
| `src/lib/auth/session.ts` | 47-49 | Rejects tokens missing any of the four claims |
| `src/services/notificationService.ts` | 116 | The only transaction in the app |
| `src/services/notificationService.ts` | 292-296 | Ownership for detail-style access |
| `src/repositories/notificationRepository.ts` | 66-70 | Repository-level self-scoping for lists |
| `src/repositories/deliveryRepository.ts` | 31 | `FOR UPDATE SKIP LOCKED` — concurrent workers do not double-claim |
| `src/services/workerService.ts` | 93 | Classifies 4xx `ApiError` as permanent |

**Exercise — Goal:** connect a line to a failure. **Check:** for line 93 of `workerService.ts`, explain
why a missing SMS phone number is treated as permanent: `sendViaChannel` throws
`ApiError(422, ...)` for a null destination (`src/lib/notifications/channels.ts:30-32`).
