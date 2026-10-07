# WW29 notification-open CRUD course

This course follows one write path in a notification delivery platform (Next.js 16 route handlers,
Prisma 7 over PostgreSQL via `@prisma/adapter-pg`, a separate polling worker): the
"mark as opened" transition in `markNotificationOpenedForSession`
([src/services/notificationService.ts:280-323](../src/services/notificationService.ts)).

That one function touches every layer worth learning here: the signed-cookie session, the central
role matrix, ownership scoping, a lifecycle precondition (`SENT`), a multi-row mutation, two levels
of derived aggregate status, and an audit write.

## What was added, and what was not

No production code changed for this course. The staged improvement is an executable service lab,
[tests/runtime-notification-open-lab.test.mjs](../tests/runtime-notification-open-lab.test.mjs). It
loads the real `notificationService.ts` and, through it, the real `permissions.ts` and
`api-errors.ts`, plus the real `deriveNotificationStatus` / `deriveBatchStatus` functions from
`notificationRepository.ts`. Prisma, the database and the other repositories are replaced with
recording doubles.

Six cases are defined (lines 53-90):

1. a `VIEWER` cannot open another recipient's notification — 404, zero writes;
2. an owner cannot open a notification with no `SENT` delivery — 409, zero writes;
3. a sent owner open records delivery open, opened-at, notification status, batch status, audit, in that order;
4. an `ADMIN` can open another recipient's sent notification through the same path;
5. mixed `OPENED` + `FAILED` deliveries derive `PARTIAL_FAILURE` for both notification and batch;
6. a failure while writing notification status propagates after the delivery and opened-at writes,
   and no batch update or audit follows — proving the operation has no enclosing transaction.

## Course map

| File | What it teaches |
|---|---|
| [01-CODEBASE-MAP.md](01-CODEBASE-MAP.md) | Layers, with a line-by-line walk of the open path |
| [02-CONCEPTS.md](02-CONCEPTS.md) | Ownership vs lifecycle vs aggregation vs atomicity |
| [03-WORKED-CHANGE.md](03-WORKED-CHANGE.md) | Why a VM lab, and what it pins that the Vitest mocks do not |
| [04-TESTING-AND-DEBUGGING.md](04-TESTING-AND-DEBUGGING.md) | Both test harnesses, how to read the call arrays |
| [05-PRACTICE.md](05-PRACTICE.md) | Graduated exercises with Goal and Check |
| [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md) | Answers plus senior-review findings with file:line |
| [07-TRACE-LAB.md](07-TRACE-LAB.md) | Trace tables for opening and for status derivation |
| [VERIFICATION.md](VERIFICATION.md) | What the recorded evidence covers and what it does not |

The `docs/architecture/` and `docs/learning/` trees cover the rest of the app (batch creation,
the worker, rate limits, the admin dashboard). Several of the most important review findings
in this course are in those other paths — notably that the rate limiter never denies
(`src/repositories/rateLimitRepository.ts:49-61`) and that stuck `PROCESSING` deliveries are never
reclaimed (`src/repositories/deliveryRepository.ts:22-28`). See
[06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md).

## Limits to keep in mind

The lab does not run Next route handlers, Zod schemas, Prisma, a real transaction, or the worker.
It demonstrates service control flow and the real derivation policy, nothing about durability.
Use those limits when reviewing any follow-up that makes opening transactional or idempotent.
