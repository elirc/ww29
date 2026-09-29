# Verification and limits

Executed from the staged `ww29` project:

```text
node --experimental-vm-modules --test tests/runtime-notification-open-lab.test.mjs
```

Six cases passed: foreign VIEWER denial with zero writes, own notification refusal when no delivery is SENT, sent owner opening with delivery/status/audit sequencing, and ADMIN opening another recipient's sent notification. The test loads the actual notification service and actual permission matrix, with explicit repository and database doubles. Results are recorded in [evidence/results.json](evidence/results.json) and the TAP log is [evidence/crud-b06-astra-runtime.log](evidence/crud-b06-astra-runtime.log).

The check does not execute Next route schemas, live Prisma transactions, delivery workers, notification attempts, or repeated-open behavior. It proves the service's authorization wiring, sent-state boundary, aggregate refresh call order, and audit invocation for the modeled cases. No production fix is claimed in this reviewed path. Before release, run normal typecheck and provider-backed tests, then make an explicit decision about transaction rollback and idempotent repeated opens. The evidence supports only the stated service-level cases.
Those follow-up checks are part of the release decision because a mocked repository cannot represent durable failure recovery.

The added cases verify mixed OPENED/FAILED delivery aggregation and propagate an injected notification-status failure after the delivery and timestamp calls. No batch update or audit follows that failure. Real ApiError and both derivation functions execute; generated enum values and an unused ZodError export are adapters. This proves call ordering, not persisted rollback: the source has no encompassing open transaction.

## Astra execution evidence

The captured focused production-source suite executed 6 tests: all passed, zero failed and zero skipped. Read the [captured output](evidence/crud-b06-astra-runtime.log) and [exact command and limits](evidence/results.json). Earlier check records remain preserved in the workspace.
