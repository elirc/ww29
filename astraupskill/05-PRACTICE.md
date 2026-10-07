# Graduated practice

Write each prediction before reading [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md). For
every exercise record the actor, the recipient, the delivery ids and the first forbidden side effect.

## Level 1 — isolation

**Goal:** Predict a denial.
A `VIEWER` requests to open another user's notification.
**Check:** You state the HTTP status, the exact error message, and that `calls` stays empty; you cite
the line that decides it.

## Level 2 — lifecycle

**Goal:** Predict a refusal on your own data.
The viewer owns the notification but its deliveries are `QUEUED` and `SKIPPED`.
**Check:** You name the status (409), the message, and whether `refreshNotificationAndBatchState`
runs (it should not).

## Level 3 — full transition

**Goal:** Trace a success.
One `SENT` delivery exists. Trace delivery open, opened-at, notification status, batch status and
audit, naming where each id comes from.
**Check:** Your sequence matches the assertion at `tests/runtime-notification-open-lab.test.mjs:69`.

## Level 4 — elevated actor

**Goal:** Find what changes for staff.
Change the actor to `ADMIN` (or `OPERATOR`) with a different recipient.
**Check:** You identify that only the branch at `notificationService.ts:292-296` changes, and you
state whether an `OPERATOR` succeeds (cite `permissions.ts:28-34`).

## Level 5 — derivation edge cases

**Goal:** Run the roll-up policy by hand.
Using `notificationRepository.ts:217-287`, derive:
(a) notification status for deliveries `[SKIPPED, SKIPPED]`;
(b) notification status for `[SENT, RETRYING]`;
(c) batch status for notifications `[PARTIAL_FAILURE, PARTIAL_FAILURE]`;
(d) batch status for `[COMPLETED, QUEUED]`.
**Check:** For each, name the line where the function returns.

## Level 6 — idempotency design

**Goal:** Choose a repeat-open policy.
Design behaviour for a second open request. Choose idempotent success, conflict, or no-op, then list
the database predicate, the audit rule and the test cases you need.
**Check:** Your design states what `openedAt` should be after the second call — note that today
`updateNotificationOpenedAt` (`notificationRepository.ts:147-157`) would overwrite it if it ran.

## Level 7 — the worker

**Goal:** Reason about at-least-once delivery.
`processSingleDelivery` calls `sendViaChannel` (line 66) and then `markDeliverySent` (line 73) as
separate steps. Describe what happens if the worker process dies between them.
**Check:** You state the delivery's persisted status after the crash, and whether
`claimDueDeliveries` will ever pick it up again (cite the `WHERE` clause at
`deliveryRepository.ts:22-28`).

## Level 8 — rate limits

**Goal:** Test a guard by hand.
EMAIL limit is 5 per hour (`rateLimitRepository.ts:69-70`). Simulate six calls to
`reserveRateLimitSlot` for one user in one window.
**Check:** Write the `sentCount` returned by each call and the resulting `allowed` value.
