# Build Journal

## Stage 1 — Project summary and boundaries
- Built: Project frame for a notification delivery platform with async delivery, retries, personalization, delivery history, preferences, and monitoring.
- Decision: Keep the product single-tenant and focus the complexity budget on queue reliability plus auth/RBAC.
- Why: The requirements explicitly emphasized async workflows and reliability, not organization scoping.

## Stage 2 — Stack selection
- Built: Next.js + React + TypeScript + Prisma + PostgreSQL + Tailwind + Zod + TanStack Query + REST APIs.
- Decision: Use Prisma instead of Drizzle.
- Why: This project benefits from Prisma's readable schema, generated enums, and straightforward transaction API for a teaching-oriented codebase.

## Stage 3 — Domain model and schema
- Built: `prisma/schema.prisma` with `NotificationBatch`, `Notification`, `NotificationDelivery`, `DeliveryAttempt`, `UserPreference`, `RateLimitWindow`, and `AuditLog`.
- Decision: Split notification intent from per-channel delivery rows.
- Why: Tracking retries, sent/opened status, and failures per channel is much cleaner when `NotificationDelivery` is a first-class model.

## Stage 4 — Auth and permissions
- Built: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, auth routes, and seeded users in `prisma/seed.ts`.
- Decision: Use custom signed cookie sessions instead of a larger auth framework.
- Why: The project needs explicit, inspectable auth flow more than provider integrations, and the custom cookie flow keeps the security boundary visible in code.

## Stage 5 — API and service boundaries
- Built: Route handlers in `src/app/api/**`, service layer in `src/services/**`, and repositories in `src/repositories/**`.
- Decision: Use REST route handlers instead of tRPC.
- Why: The learning goal here is following request flow through explicit HTTP, validation, auth, service logic, and repositories.

## Stage 6 — Async workflow and monitoring
- Built: `src/services/workerService.ts`, `src/workers/notificationWorker.ts`, queue claiming, retry logic, rate limits, and the admin dashboard route/UI.
- Decision: Use a Postgres-backed queue table with a separate worker process.
- Why: It teaches durable async workflows inside the codebase without adding Redis or a managed queue.

## Stage 7 — Tests and docs
- Built: Focused tests under `tests/` and code-anchored docs under `docs/`.
- Decision: Keep the test suite intentionally small but target production failure classes.
- Why: This project is meant to teach reviewable architecture, not to hide behind massive scaffolding.

## Major decisions

### Decision: Async queue architecture
- Why it matters: Delivery reliability, retries, and rate limits all depend on how async work is claimed and persisted.
- Options considered:
  - In-process timers in the web app. Pro: trivial to start. Con: work dies with the request or process.
  - Redis + BullMQ. Pro: mature queue tooling. Con: extra infrastructure and less queue mechanics inside the codebase.
  - Postgres-backed queue table plus worker. Pro: durable, uses existing infra, and teaches locking/lease design directly in code.
  - Managed queue service. Pro: operationally strong. Con: hides the reliability mechanics the project is meant to teach.
- Choice: Postgres-backed queue table plus `src/workers/notificationWorker.ts`.
- Why this option won: It matches the learning goals and keeps the infra footprint small while still being production-realistic.
- Junior vs mid vs senior:
  - Junior notices the worker exists.
  - Mid notices `claimDueDeliveries()` uses atomic SQL instead of ad hoc polling.
  - Senior worries about lease expiry, worker concurrency, and future dead-letter strategy.
- Logged in code: `src/repositories/deliveryRepository.ts`, `src/services/workerService.ts`, `src/workers/notificationWorker.ts`.

### Decision: Auth strategy
- Why it matters: Every protected API route depends on a trustworthy caller identity and role.
- Options considered:
  - Auth.js / NextAuth. Pro: rich ecosystem. Con: more framework surface than this project needs.
  - Custom signed cookie sessions. Pro: explicit and easy to trace end to end.
  - Stateless bearer tokens only. Pro: simple for APIs. Con: worse fit for this dashboard-style app and would still need secure storage on the client.
- Choice: Custom signed cookie sessions in `src/lib/auth/session.ts`.
- Why this option won: The code stays compact and the full session lifecycle is visible to a learner.
- Junior vs mid vs senior:
  - Junior notices login works.
  - Mid notices the cookie is HTTP-only and the role comes from a signed payload.
  - Senior worries about rotation, revocation, and long-term session invalidation strategy.
- Logged in code: `src/app/api/auth/login/route.ts`, `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`.

### Decision: Template model
- Why it matters: Templates and personalization affect authoring UX and delivery correctness.
- Options considered:
  - Raw content only. Pro: simplest. Con: weak reuse and inconsistent messaging.
  - One template model that stores content for every channel. Pro: one object per campaign. Con: harder validation and more conditional logic.
  - Single-channel templates plus raw multi-channel fallback. Pro: simple validation and explicit rendered content.
- Choice: Single-channel templates in `prisma/schema.prisma` with raw content fallback in `src/services/notificationService.ts`.
- Why this option won: It keeps the validation boundary crisp while still demonstrating reusable templates.
- Junior vs mid vs senior:
  - Junior notices templates are reusable.
  - Mid notices template batches are intentionally limited to one channel.
  - Senior worries about future authoring UX if product requirements demand multi-channel template families.
- Logged in code: `prisma/schema.prisma`, `src/lib/validation/notificationSchemas.ts`, `src/services/notificationService.ts`.

### Decision: Service and repository layering
- Why it matters: The project must stay reviewable as the notification workflow grows.
- Options considered:
  - Fat route handlers. Pro: fewer files at first. Con: auth, validation, and Prisma logic get tangled fast.
  - Service + repository split. Pro: explicit ownership for business logic and database access.
  - Generic abstraction-heavy domain framework. Pro: can be powerful later. Con: too magical for this teaching goal.
- Choice: Thin routes, service layer, repository layer.
- Why this option won: It keeps request flow legible and makes it obvious where each rule lives.
- Junior vs mid vs senior:
  - Junior notices there are more files than a tutorial app.
  - Mid notices routes are mostly orchestration boundaries.
  - Senior worries about keeping repository scope strict so services do not regress into direct ORM access.
- Logged in code: `src/app/api/notifications/route.ts`, `src/services/notificationService.ts`, `src/repositories/notificationRepository.ts`.

### Decision: Multi-tenancy exclusion
- Why it matters: Tenant scope changes every auth and query decision in a SaaS product.
- Options considered:
  - Add full tenant-aware modeling now. Pro: future-ready. Con: complexity not asked for by the requirements.
  - Keep explicit auth/RBAC and user ownership only. Pro: focuses the project on delivery reliability.
- Choice: No multi-tenancy in this version.
- Why this option won: It preserves clarity around the async system while still showing explicit auth and scoping.
- Junior vs mid vs senior:
  - Junior notices user ownership checks.
  - Mid notices the repo design could accept tenant filters later.
  - Senior worries about how to propagate tenant context into every repository once needed.
- Logged in docs: `docs/architecture/auth-and-permissions.md`.

## PR Slices

### Slice 1 — Foundation, schema, and auth
- Purpose in one sentence: Establish the runtime stack, domain schema, seeded users, and cookie-based auth/RBAC boundary.
- Files with novel logic:
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
  - `src/lib/auth/session.ts`
  - `src/lib/auth/permissions.ts`
  - `src/services/authService.ts`
  - `src/app/api/auth/login/route.ts`
- Reviewer focus:
  - `prisma/schema.prisma`: verify `NotificationDelivery` includes lock and retry metadata, not just statuses.
  - `src/lib/auth/session.ts`: verify `requireApiSession()` rejects before business logic and that signed cookie payload contains only trusted fields.
  - `src/lib/auth/permissions.ts`: verify each role capability aligns with product intent.
- Junior reviewer trap: Approving login because it works without questioning whether role checks are centralized.

### Slice 2 — Batch creation and notification read model
- Purpose in one sentence: Add the main notification APIs, validation, rendering, and ownership-aware reads.
- Files with novel logic:
  - `src/lib/validation/notificationSchemas.ts`
  - `src/lib/notifications/rendering.ts`
  - `src/services/notificationService.ts`
  - `src/repositories/notificationRepository.ts`
  - `src/repositories/userRepository.ts`
  - `src/app/api/notifications/route.ts`
- Reviewer focus:
  - `src/services/notificationService.ts`: verify the transaction boundary around batch creation and the `SKIPPED` delivery handling.
  - `src/repositories/notificationRepository.ts`: verify viewer scoping happens in the repository query itself.
  - `src/lib/validation/notificationSchemas.ts`: verify cross-field rules match service assumptions.
- Junior reviewer trap: Approving because the happy path queues a batch without checking ownership and invalid template/channel combinations.

### Slice 3 — Worker, queue claiming, retries, and rate limits
- Purpose in one sentence: Implement durable background delivery processing with safe claiming and retry semantics.
- Files with novel logic:
  - `src/repositories/deliveryRepository.ts`
  - `src/repositories/rateLimitRepository.ts`
  - `src/services/workerService.ts`
  - `src/workers/notificationWorker.ts`
  - `src/lib/notifications/channels.ts`
- Reviewer focus:
  - `src/repositories/deliveryRepository.ts`: verify `claimDueDeliveries()` is atomic and lease-aware.
  - `src/repositories/rateLimitRepository.ts`: verify rate-limit increments are atomic under concurrent workers.
  - `src/services/workerService.ts`: verify permanent failure, retry, and rate-limit deferral all end in the correct persisted states.
- Junior reviewer trap: Approving a retry loop without asking how duplicate sends are prevented.

### Slice 4 — Preferences and monitoring
- Purpose in one sentence: Add user preference management, audit logging, and admin monitoring APIs/UI.
- Files with novel logic:
  - `src/services/preferenceService.ts`
  - `src/repositories/preferenceRepository.ts`
  - `src/repositories/auditLogRepository.ts`
  - `src/services/monitoringService.ts`
  - `src/repositories/dashboardRepository.ts`
  - `src/app/api/preferences/route.ts`
  - `src/app/api/admin/dashboard/route.ts`
- Reviewer focus:
  - `src/services/preferenceService.ts`: verify writes are audited and user ownership is explicit.
  - `src/services/monitoringService.ts`: verify admin enforcement happens server-side, not just in the page.
  - `src/repositories/dashboardRepository.ts`: verify the dashboard metrics are a single coherent read model.
- Junior reviewer trap: Approving the dashboard page because the link is hidden for non-admins without verifying the API route.

### Slice 5 — UI polish, tests, and code-anchored docs
- Purpose in one sentence: Add the operator/viewer/admin screens, focused tests, and the architectural learning docs.
- Files with novel logic:
  - `src/app/notifications/page.tsx`
  - `src/app/preferences/page.tsx`
  - `src/app/admin/page.tsx`
  - `tests/admin-dashboard-auth.test.ts`
  - `tests/notification-open-transition.test.ts`
  - `tests/notification-data-isolation.test.ts`
  - `docs/architecture/request-lifecycle.md`
  - `docs/learning/flow-traces.md`
- Reviewer focus:
  - `tests/admin-dashboard-auth.test.ts`: verify the route-level permission rejection is truly server-side.
  - `tests/notification-open-transition.test.ts`: verify invalid state transitions are blocked before mutation.
  - `docs/learning/flow-traces.md`: verify the documented flows still match the real function names and files.
- Junior reviewer trap: Treating docs and tests as secondary polish instead of checking whether they capture the load-bearing risks accurately.
