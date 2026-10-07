# Worked runtime addition

This course did not patch production code. The worked change is a test: a lab that executes the
real service where the existing Vitest suite mostly executes mocks.

## Before: what the existing Vitest tests could prove

- `tests/notification-open-transition.test.ts` (`it` at line 43) mocks every repository module with
  `vi.mock` and asserts that opening a never-sent notification is rejected.
- `tests/notification-data-isolation.test.ts` (`it` at line 43) mocks the repository so
  `findNotificationDetail` returns a notification for `someone-else`, and asserts
  `getNotificationDetailForSession` rejects a viewer.

Because `deriveNotificationStatus` and `deriveBatchStatus` are mocked as bare `vi.fn()` in those
files (see the `vi.mock("@/repositories/notificationRepository", ...)` block in
`notification-data-isolation.test.ts`), no Vitest test exercises the real derivation policy or the
full write sequence of a successful open.

## After: what the lab adds

`tests/runtime-notification-open-lab.test.mjs`:

- line 15 loads the **real** `notificationRepository.ts` with `@prisma/client` replaced by plain
  enum objects (lines 7-14) and `@/lib/db` replaced by an empty `prisma`, so only the pure
  derivation functions are usable;
- lines 36-46 load the **real** `notificationService.ts`, stubbing each repository module with
  recorders and wiring in the real `deriveNotificationStatus` / `deriveBatchStatus` (line 43);
- the fixture (lines 17-33) returns a realistic detail object and records every write in `calls`.

So a sent-owner open now proves the exact order:

```text
['open-deliveries', ['delivery-1']]
['opened-at', 'notification-1']
['notification-status', 'notification-1', 'COMPLETED']
['batch-status', 'batch-1', 'COMPLETED']
['audit', 'notifications.opened']
```

(assertion at line 69). The foreign-viewer and unsent cases assert `calls` is empty (lines 56, 62).

## Why a lab rather than more `vi.mock`

A mock-based test asserts that a function was called; it cannot tell you whether the service would
have called it with a real policy in place. Here the policy functions are real, so if someone
changed `deriveNotificationStatus` to treat `OPENED` as non-terminal, case 3 would fail on the
`'COMPLETED'` value, not merely on a call count.

## What the change deliberately leaves open

- **Transactions.** Case 6 documents partial progress rather than fixing it.
- **Repeated opens.** No case calls the operation twice. From the code, the second call returns
  409 because no delivery is `SENT` any more (`notificationService.ts:302-304`).
- **Operator opens.** Case 4 pins that elevated roles may open other people's notifications; it
  does not argue that this is the right product rule.
- **Routes and schemas.** The lab calls the service directly; `requireApiSession` and the JWT are
  not involved. The admin-dashboard Vitest test is the only one that drives a real route handler
  with a real signed cookie (`tests/admin-dashboard-auth.test.ts:11-28`).

## Exercise

**Goal:** Prove the lab exercises real policy.
**Check:** Without running anything, predict what case 5 (lines 78-84) would assert if
`deriveBatchStatus` were mocked to always return `"QUEUED"`. Expected: the `slice(2,4)` comparison
fails because the batch-status entry would be `['batch-status', 'batch-1', 'QUEUED']` instead of
`PARTIAL_FAILURE`.
