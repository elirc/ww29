# Testing Rationale

## `tests/admin-dashboard-auth.test.ts` — rejects an operator session with 403

This is worth a test because admin dashboards are a classic place where teams accidentally rely on hidden navigation instead of real server-side authorization. The failure mode here is silent privilege escalation: an operator or viewer can hit the route directly and read operational data the UI never intended to show them.

A more thorough production suite would add:
- A positive test for `ADMIN`
- A `401` case for no session
- An integration test that exercises the actual client page plus route

## `tests/notification-schema.test.ts` — rejects an email batch without a subject when no template is provided

This is worth a test because invalid message shape should die at the validation boundary, not after the service has already started creating batch or delivery records. The failure mode here is partially defined queued work that only fails much later in the worker.

A more thorough production suite would add:
- More schema rejection cases for template/channel mismatches and oversized recipient lists
- Contract tests covering every supported channel combination
- Snapshot tests for validation payload shape if the frontend depends on it

## `tests/notification-open-transition.test.ts` — rejects opening a notification that has never been sent

This is worth a test because state transitions are where systems quietly lose integrity. If `FAILED` or `QUEUED` deliveries could move to `OPENED`, dashboards and downstream analytics would become untrustworthy.

A more thorough production suite would add:
- An idempotency test for already-opened notifications
- A positive test proving `SENT -> OPENED` works and recomputes aggregate state
- Route-level coverage for the endpoint in addition to the service-level transition test

## `tests/notification-data-isolation.test.ts` — does not return another viewer's notification detail

This is worth a test because list scoping alone is not enough. Attackers and curious users guess IDs and hit detail endpoints directly. The failure mode here is a direct data leak even if the list page looked correct.

A more thorough production suite would add:
- A list-endpoint scoping test against real seeded data
- Mutation tests proving one viewer cannot open another viewer's notification
- Integration coverage once tenant or organization scope is introduced in the future

## `tests/runtime-notification-open-lab.test.mjs` — six service-level cases

Added later as a `node:test` file run with `node --experimental-vm-modules --test`. It loads the real
`notificationService.ts`, permission matrix and status-derivation functions, and records repository
writes. It covers the two follow-ups suggested above for the open transition — the positive
`SENT -> OPENED` path with aggregate recomputation (lines 65-70) and cross-viewer open rejection
(lines 53-57) — plus admin opens, mixed-status derivation, and partial progress when an aggregate
write fails (lines 86-90). It still does not cover idempotent repeat opens.

## What each Vitest test really exercises

| Test | Real code executed | Mocked |
|---|---|---|
| `admin-dashboard-auth` | route handler, `requireApiSession`, JWT sign/verify with `jose`, `requireAction`, `withRouteErrorHandling` | nothing; the 403 is thrown before any query |
| `notification-schema` | `createNotificationBatchSchema` and its `superRefine` | nothing |
| `notification-open-transition` | `markNotificationOpenedForSession` up to the `SENT` check | all repositories via `vi.mock`, including the derive functions |
| `notification-data-isolation` | `getNotificationDetailForSession` | all repositories via `vi.mock` |

## The riskiest untested code

These are the places where the code has real defects that a test would have caught (details in
`astraupskill/06-SOLUTIONS-AND-REVIEW.md`):

1. `reserveRateLimitSlot` — an integration test sending `limit + 1` reservations would show the
   last one still returns `allowed: true` (`src/repositories/rateLimitRepository.ts:49-61`).
2. `processSingleDelivery` transient path — a unit test with a stubbed repository would show
   `attemptCount` never increases on `RETRYING` (`src/repositories/deliveryRepository.ts:115-132`).
3. `claimDueDeliveries` — an integration test that leaves a row `PROCESSING` with an old `lockedAt`
   would show it is never reclaimed (`deliveryRepository.ts:22-28`).
4. `deriveBatchStatus` — a pure unit test with `[PARTIAL_FAILURE, PARTIAL_FAILURE]` would show it
   returns `QUEUED` (`src/repositories/notificationRepository.ts:284-286`).

**Exercise — Goal:** write the cheapest of these tests. **Check:** item 4 needs no database: import
`deriveBatchStatus` in a Vitest file and assert the result for `["PARTIAL_FAILURE", "PARTIAL_FAILURE"]`.
Decide first what the correct answer should be (most teams would say `PARTIAL_FAILURE`).
