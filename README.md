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

## Docs

- Architecture: `docs/architecture/*`
- Learning guides: `docs/learning/*`
