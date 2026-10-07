# Concepts: ownership and state transition

Opening a notification is a constrained update. Four separate questions are answered, in this
order, by different lines of code. Keep them separate when you review changes.

## 1. Who may see this record (ownership)

`notificationService.ts:292-296`. A `VIEWER` who is not the recipient gets the same 404 and message
as a missing record, so a guessed id reveals nothing. Roles with `notifications:view:any`
(ADMIN and OPERATOR, `permissions.ts:22, 30`) skip the recipient comparison.

Notice the naming mismatch: the route and the service require `notifications:open:own`, but the
code lets any-viewers open **other people's** notifications. The lab's case 4 pins this behaviour
(`tests/runtime-notification-open-lab.test.mjs:72-76`). Whether an operator should be able to
generate an "opened" event for a customer is a product question; as written, open metrics can be
inflated by staff.

## 2. Is the transition legal (lifecycle)

`notificationService.ts:298-304`. Only deliveries currently `SENT` are eligible. `QUEUED`, `SKIPPED`,
`FAILED`, `RETRYING`, `RATE_LIMITED`, `PROCESSING` and already-`OPENED` deliveries are not. The
repository update repeats the predicate in SQL (`deliveryRepository.ts:161`), which protects
against a delivery changing state between the read at line 286 and the write at line 306.

A second open of the same notification after all deliveries became `OPENED` therefore returns 409
"Only sent notifications can transition to opened." Repeated opens are not idempotent successes.

## 3. What do parents look like now (aggregation)

`refreshNotificationAndBatchState` (`notificationService.ts:57-71`) recomputes from scratch rather
than incrementing. The policies are in `notificationRepository.ts`:

- `deriveNotificationStatus` (lines 217-258): no deliveries -> `QUEUED`; all in
  {`SENT`, `OPENED`, `SKIPPED`} -> `COMPLETED`; all in {`FAILED`, `SKIPPED`} -> `FAILED`;
  some delivered and some `FAILED` -> `PARTIAL_FAILURE`; otherwise `PROCESSING` if any delivery is
  `PROCESSING`, else `QUEUED`.
- `deriveBatchStatus` (lines 260-287): all `COMPLETED` -> `COMPLETED`; all `FAILED` -> `FAILED`;
  some `COMPLETED` and some `FAILED`/`PARTIAL_FAILURE` -> `PARTIAL_FAILURE`; otherwise
  `PROCESSING` or `QUEUED`.

Two consequences worth knowing:

- `SKIPPED` is in both the "completed" and "failed" sets. A notification whose deliveries were all
  skipped (opt-outs) is `COMPLETED`, because the "completed" check runs first.
- A batch where every notification is `PARTIAL_FAILURE` matches none of the explicit branches and
  falls through to `QUEUED` (lines 273-286 require at least one `COMPLETED`). That is a real
  mislabel; see the review findings.

## 4. What happens if a write fails halfway (atomicity)

There is no transaction around lines 306-318. Lab case 6 (lines 86-90) injects a failure into
`updateNotificationStatus` and shows the delivery-open and opened-at writes have already happened,
while batch status and audit never run. In production that leaves an `OPENED` delivery with a
stale notification status and no audit row. The next successful refresh for that notification
(for example, from the worker's `recomputeNotificationState`, `workerService.ts:58, 85, 122`)
would correct the status, but nothing recreates the missing audit row.

## How these fit together

| Concern | Line(s) | Failure mode if removed |
|---|---|---|
| Ownership | 292-296 | Any viewer opens anyone's notification |
| Lifecycle | 298-304, plus SQL predicate at `deliveryRepository.ts:161` | Queued or failed deliveries marked opened |
| Aggregation | 308 -> 57-71 | Notification and batch dashboards drift from delivery truth |
| Audit | 310-318 | No trail of who opened what |

## Exercise

**Goal:** Classify inputs by the concern that rejects them.
**Check:** For each case name the line that decides the outcome: (a) a VIEWER opens someone else's
SENT notification; (b) a VIEWER opens their own notification whose only delivery is `OPENED`;
(c) an OPERATOR opens someone else's SENT notification; (d) the id does not exist. Expected:
(a) 294 -> 404; (b) 302 -> 409; (c) passes 292-296 and 302, succeeds; (d) 288 -> 404.
