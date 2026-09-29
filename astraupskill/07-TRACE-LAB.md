# Trace lab

| Actor and delivery state | Visibility result | Transition calls | Result |
|---|---|---|---|
| VIEWER, foreign, SENT | denied as unavailable | none | 404 |
| VIEWER, own, QUEUED | allowed to inspect, not transitionable | none | 409 |
| VIEWER, own, SENT | allowed and eligible | open, timestamp, refresh, audit | opened true |
| ADMIN, foreign, SENT | any-recipient visibility | same transition as owner | opened true |

The first row demonstrates data isolation; the second demonstrates lifecycle refusal. The third shows that the opened result is an aggregate operation, not merely a boolean on one delivery. The fourth proves elevated visibility does not create a separate mutation algorithm. Run [the lab](../tests/runtime-notification-open-lab.test.mjs) and compare its call list to the table. Then add a fixture with two SENT deliveries and verify whether both ids are opened by current policy. A provider trace should include transaction boundaries and update predicates. The staged trace only proves service control flow with repository doubles, so it cannot establish atomicity if the status refresh or audit write fails.
Additional recorded traces: mixed OPENED/FAILED states lead to PARTIAL_FAILURE updates; an injected notification-status failure stops before batch update and audit, after the two opening writes. These distinguish computed status policy from failure recovery.
