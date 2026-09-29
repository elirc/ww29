# Graduated practice

**Level 1:** A VIEWER requests another user's notification. Predict the status and every repository mutation. Explain why a 404 protects existence privacy.

**Level 2:** The viewer owns the notification but deliveries are QUEUED and SKIPPED. Predict the response and whether aggregate refresh occurs.

**Level 3:** A SENT delivery exists. Trace delivery open, opened timestamp, notification status, batch status, and audit metadata. Identify the source of each id.

**Level 4:** Change the actor to ADMIN while leaving the recipient different. Predict which permission branch changes and which lifecycle checks remain identical.

**Level 5:** Design a retry policy for a repeated open request. Choose idempotent success, conflict, or no-op, then list the database predicate, audit rule, and test cases needed. Separately design a failure test for batch status refresh. Do not assume a service-level fake proves transaction rollback. Write each prediction before looking at the solutions.
For every exercise, record the actor, target recipient, delivery ids, and first forbidden side effect so your answer remains inspectable against the service trace.
