# Verification and limits

## Recorded evidence (historical)

[evidence/results.json](evidence/results.json) records a run of:

```text
node --experimental-vm-modules --test tests/runtime-notification-open-lab.test.mjs
```

from a staging copy of the project, with six tests passing. The JSON refers to a TAP log named
`crud-b06-astra-runtime.log`; that log is **not** included in this repository's `evidence/`
folder, so the JSON is the only artifact here. Re-run the command yourself before relying on it.

## What the six cases assert

| Case | Lines | Assertion |
|---|---|---|
| foreign VIEWER | 53-57 | rejects with `status === 404`; `calls` empty |
| own, unsent | 59-63 | rejects with `status === 409`; `calls` empty |
| own, sent | 65-70 | exact five-entry call sequence ending in audit |
| ADMIN, foreign | 72-76 | `opened: true`; last call is the audit |
| mixed statuses | 78-84 | notification and batch both `PARTIAL_FAILURE` |
| aggregate failure | 86-90 | the injected error propagates; only the first two writes recorded |

Real code executed: `notificationService.ts`, `permissions.ts`, `api-errors.ts`, and the two
derivation functions from `notificationRepository.ts`. Adapters: Prisma enums, `@/lib/db`, `zod`'s
`ZodError` (imported by `api-errors.ts` but unused on this path), rendering helpers and all
repository writes.

## What is not verified

Next route handlers, Zod parsing, the JWT session, live Prisma, transactions, the worker, delivery
attempts, rate limiting, and repeated-open behaviour. No production fix is claimed.

The Vitest suite (`npm test`) is a separate harness; this lab is not part of it by design, and
nothing in the repository wires it into a script.

## Before treating this path as release-ready

- decide and test transaction boundaries for open (finding 5 in
  [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md));
- decide repeat-open semantics;
- fix the rate limiter and the stranded-`PROCESSING` claim (findings 1 and 2), which are outside this
  path but affect the same delivery rows this path reads;
- run typecheck and provider-backed tests against a real PostgreSQL database.
