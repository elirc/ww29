# Notification Delivery Platform

Production-style Next.js application for sending queued notifications over email, SMS, and push with retry logic, delivery history, user preferences, rate limiting, and an admin monitoring surface.

## Stack

- Next.js 16 + React + TypeScript
- PostgreSQL + Prisma 7
- Tailwind CSS
- Zod validation
- TanStack Query
- REST route handlers
- Dedicated Node worker in `src/workers/notificationWorker.ts`

## Run Locally

1. Copy `.env.example` values into `.env` if needed.
2. Start PostgreSQL and point `DATABASE_URL` at it.
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Run `npm run db:push`.
6. Run `npm run db:seed`.
7. In one terminal run `npm run dev`.
8. In another terminal run `npm run worker`.

Seeded credentials live on the home page in `src/app/page.tsx`.

Those are `admin@example.com`, `operator@example.com` and `viewer@example.com`, all with password
`Password123!` (`src/app/page.tsx:4-6`). The seed also creates two more viewers,
`customer.one@example.com` and `customer.two@example.com`; customer two has quiet hours 22:00-06:00
(`prisma/seed.ts:84-85`).

## Environment

`src/lib/env.ts` validates at import time:

- `DATABASE_URL` — required (PostgreSQL connection string, used by `src/lib/db.ts` through a `pg` pool).
- `SESSION_SECRET` — required, at least 16 characters; signs the session JWT.
- `WORKER_ID` — optional, defaults to `local-worker-1`; written into `lockedBy` when the worker claims rows.

## Tests

- `npm test` runs the Vitest suite in `tests/*.test.ts` (four files; `tests/setup.ts` supplies
  placeholder env values, and none of them needs a database).
- `node --experimental-vm-modules --test tests/runtime-notification-open-lab.test.mjs` runs the
  separate service lab described in `astraupskill/`.

## Known issues (found during doc review)

- The per-user rate limit never denies (`src/repositories/rateLimitRepository.ts:49-61`).
- Transient delivery failures retry every minute forever (`src/repositories/deliveryRepository.ts:115-132`
  never increments `attemptCount`).
- Deliveries left in `PROCESSING` by a crashed worker are never reclaimed
  (`src/repositories/deliveryRepository.ts:22-28`).

Details and suggested fixes are in `astraupskill/06-SOLUTIONS-AND-REVIEW.md`.

## Docs

- Architecture: `docs/architecture/*`
- Learning guides: `docs/learning/*`
- Focused course on the open transition: `astraupskill/README.md`
