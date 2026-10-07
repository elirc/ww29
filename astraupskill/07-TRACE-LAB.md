# Trace lab

## Table A — the open transition (matches lab cases 1-4)

| Actor and delivery state | Visibility (lines 292-296) | Eligibility (298-304) | Transition calls | Result |
|---|---|---|---|---|
| VIEWER, foreign, SENT | denied as unavailable | not reached | none | 404 |
| VIEWER, own, QUEUED | allowed | no SENT delivery | none | 409 |
| VIEWER, own, SENT | allowed | eligible | open, opened-at, notification status, batch status, audit | `{ opened: true }` |
| ADMIN, foreign, SENT | any-recipient visibility | eligible | same as owner | `{ opened: true }` |
| OPERATOR, foreign, SENT | any-recipient visibility | eligible | same as owner | `{ opened: true }` (derived from code, not a lab case) |
| VIEWER, own, already OPENED | allowed | no SENT delivery | none | 409 (derived from code) |

The first row demonstrates data isolation; the second, lifecycle refusal; the third, that opening is
an aggregate operation, not a boolean on one row; the fourth, that elevated visibility does not
create a separate mutation algorithm.

## Table B — recorded extra cases (lab cases 5-6)

| Setup | Calls observed | Meaning |
|---|---|---|
| deliveries `[OPENED, FAILED]`, batch `[COMPLETED, PARTIAL_FAILURE]` | notification `PARTIAL_FAILURE`, batch `PARTIAL_FAILURE` | the real derivation policy runs |
| `updateNotificationStatus` throws | only `open-deliveries` and `opened-at` | no batch update, no audit; earlier writes are not undone |

## Table C — `deriveNotificationStatus` (`notificationRepository.ts:217-258`)

| Delivery statuses | Returns | Line |
|---|---|---|
| `[]` | QUEUED | 219 |
| `[SENT]`, `[OPENED]`, `[SKIPPED]` | COMPLETED | 239 |
| `[FAILED]`, `[FAILED, SKIPPED]` | FAILED | 245 |
| `[SENT, FAILED]` | PARTIAL_FAILURE | 252 |
| `[SENT, PROCESSING]` | PROCESSING | 255-256 |
| `[SENT, RETRYING]` | QUEUED | 255-257 |
| `[QUEUED, RATE_LIMITED]` | QUEUED | 255-257 |

## Table D — `deriveBatchStatus` (`notificationRepository.ts:260-287`)

| Notification statuses | Returns | Line |
|---|---|---|
| all COMPLETED | COMPLETED | 266 |
| all FAILED | FAILED | 270 |
| COMPLETED + FAILED or PARTIAL_FAILURE | PARTIAL_FAILURE | 281 |
| all PARTIAL_FAILURE | QUEUED | 284-286 |
| PARTIAL_FAILURE + FAILED | QUEUED | 284-286 |
| any PROCESSING, no earlier match | PROCESSING | 284-285 |

Tables C and D are derived by reading the functions; only the `[OPENED]`, `[OPENED, FAILED]` and
`[COMPLETED, PARTIAL_FAILURE]` rows are exercised by the lab.

## Exercise

**Goal:** Extend the lab on paper.
**Check:** Write a seventh case with two `SENT` deliveries and predict the first `calls` entry. It
should be `['open-deliveries', ['delivery-1', 'delivery-2']]`, because line 298-300 collects every
`SENT` id and line 306 opens them in one `updateMany`.

A provider trace should also record transaction boundaries and the `WHERE status = 'SENT'` predicate.
The staged trace proves service control flow with doubles; it cannot establish atomicity.
