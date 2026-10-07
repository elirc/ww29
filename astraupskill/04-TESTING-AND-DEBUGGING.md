# Testing and debugging

## Two harnesses

| Harness | Files | Command |
|---|---|---|
| Vitest 4 | `tests/admin-dashboard-auth.test.ts`, `notification-data-isolation.test.ts`, `notification-open-transition.test.ts`, `notification-schema.test.ts` | `npm test` -> `vitest run` (`package.json:10`); setup in `tests/setup.ts`, `@` alias in `vitest.config.ts:6-9` |
| `node:test` VM lab | `tests/runtime-notification-open-lab.test.mjs` + `tests/helpers/load-typescript.mjs` | `node --experimental-vm-modules --test tests/runtime-notification-open-lab.test.mjs` |

`tests/setup.ts` sets placeholder `DATABASE_URL`, `SESSION_SECRET` and `WORKER_ID` values so that
importing `src/lib/env.ts` does not throw. No Vitest test connects to the database: the
admin-dashboard test is rejected by `requireAction` before `getDashboardSnapshot` would query.

## How the VM lab loads code

`loadTypeScript(file, { root, stubs })` strips TypeScript types, evaluates modules in a `vm` context,
and resolves any import listed in `stubs` to a synthetic module with exactly those exports. In this
lab, `@prisma/client`, `@/lib/db`, `zod`, `@/lib/notifications/rendering` and every repository
module are stubbed; `@/lib/auth/permissions` and `@/lib/http/api-errors` are **not** stubbed, so the
real matrix and the real `ApiError` class load.

Because the service runs in a separate realm, assertions use `e.status === 404` rather than
`instanceof ApiError` (lines 55, 61).

## Reading failures

- **Foreign viewer case writes something.** The first entry in `calls` tells you which line ran
  that should not have. If it is `open-deliveries`, the recipient comparison at
  `notificationService.ts:294` was bypassed. A 403 instead of 404 means someone replaced the
  ownership branch with a `requireAction` call — a policy change that leaks existence.
- **Unsent case writes something.** Inspect the filter at lines 298-300. It must reject before
  line 306.
- **Success case has the right calls in the wrong order.** Compare with the expected order:
  delivery open, opened-at, notification status, batch status, audit.
- **Status value wrong in case 3 or 5.** The fixture's `getDeliveryStatusesForNotification` and
  `getNotificationStatusesForBatch` determine the inputs; check which policy branch in
  `notificationRepository.ts:217-287` those inputs reach.

## Debugging the live system

Useful read-only queries against a seeded database (written here for reference; run them yourself):

- deliveries stuck in `PROCESSING`: compare `status = 'PROCESSING'` rows against `lockedAt`. The
  dashboard exposes the stale count via `countStaleProcessingDeliveries`
  (`deliveryRepository.ts:179-190`).
- attempt history for one delivery: `DeliveryAttempt` rows ordered by `createdAt`, which
  `findNotificationDetail` already includes (`notificationRepository.ts:124-131`).
- rate-limit windows: `RateLimitWindow` rows keyed by `(userId, channel, windowStart)`
  (`schema.prisma:184`). If `sentCount` sits at the channel limit while deliveries keep being sent,
  you are looking at review finding 1 in [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md).

## Coverage gaps

- No test touches `workerService.ts`, `deliveryRepository.ts`, or `rateLimitRepository.ts`. The two
  raw-SQL statements — the claim and the rate-limit upsert — are untested.
- No test exercises `createNotificationBatchForSession` beyond the Zod schema.
- No test covers login, JWT expiry, or the cookie parser.
- No test checks the opened-twice behaviour.

## Exercise

**Goal:** Write the missing repeat-open case.
**Check:** Your fixture returns a detail with one delivery whose status is `OPENED`. Your assertion
expects rejection with `status === 409` and `calls` deep-equal to `[]`. Explain from
`notificationService.ts:298-304` why that is the current behaviour.
