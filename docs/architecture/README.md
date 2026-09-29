# Architecture Overview

This project is a notification delivery platform built as a single TypeScript application with a separate background worker process. The web app owns auth, CRUD-style operational APIs, and dashboards. The worker in `src/workers/notificationWorker.ts` owns async delivery, retry scheduling, and rate-limit enforcement.

## Top-level folders

- `src/app/`
  Example files: `src/app/api/notifications/route.ts`, `src/app/notifications/page.tsx`
  This is the Next.js app router layer. Route handlers stay thin and hand off to services after calling `requireApiSession()` and Zod schemas.

- `src/services/`
  Example files: `src/services/notificationService.ts`, `src/services/workerService.ts`
  This is the business-logic layer. It owns workflows like batch creation, open tracking, aggregate status recomputation, and delivery retries.

- `src/repositories/`
  Example files: `src/repositories/notificationRepository.ts`, `src/repositories/deliveryRepository.ts`
  This is the database boundary. Prisma queries and queue-claim SQL live here so service code does not embed query details.

- `src/lib/`
  Example files: `src/lib/auth/session.ts`, `src/lib/validation/notificationSchemas.ts`, `src/lib/notifications/rendering.ts`
  Shared infrastructure lives here: auth/session parsing, RBAC helpers, validation schemas, template rendering, provider simulation, and DB setup.

- `src/components/` and `src/hooks/`
  Example files: `src/components/forms/notification-batch-form.tsx`, `src/hooks/useNotifications.ts`
  This is the client-side UI layer. Hooks talk to REST endpoints. React components stay presentation-focused and avoid owning backend rules.

- `prisma/`
  Example files: `prisma/schema.prisma`, `prisma/seed.ts`
  This folder defines the durable domain model and local seed data used by the app.

- `docs/`
  Example files: `docs/architecture/request-lifecycle.md`, `docs/learning/flow-traces.md`
  These docs trace the real code paths and load-bearing decisions in the generated codebase.

## Why this structure matters

The design pushes decisions downward in a deliberate order:

1. Route handlers in `src/app/api/*` authenticate and validate.
2. Services in `src/services/*` apply business rules.
3. Repositories in `src/repositories/*` own all Prisma access.
4. The worker in `src/workers/notificationWorker.ts` runs async delivery outside the request lifecycle.

That separation is what makes the queue, retries, status transitions, and auth boundaries reviewable instead of implicit.
