/*
 * This file owns background processing for queued deliveries, including retries and rate-limit deferrals.
 * It is called by `src/workers/notificationWorker.ts`.
 * It calls the delivery queue repository, rate-limit repository, provider abstraction, and notification aggregate updates.
 * A junior engineer often treats retries as a simple loop, but durable async work needs explicit lock release, retry scheduling, and terminal failure rules.
 */
import { DeliveryStatus } from "@prisma/client";

import { ApiError } from "@/lib/http/api-errors";
import { sendViaChannel } from "@/lib/notifications/channels";
import { resolveChannelTarget } from "@/lib/notifications/rendering";
import {
  claimDueDeliveries,
  createDeliveryAttempt,
  markDeliveryDeferred,
  markDeliveryFailed,
  markDeliverySent
} from "@/repositories/deliveryRepository";
import { getChannelLimit, reserveRateLimitSlot } from "@/repositories/rateLimitRepository";
import { recomputeNotificationState } from "@/services/notificationService";

function getRetryDelayMinutes(attemptCount: number) {
  if (attemptCount <= 1) {
    return 1;
  }

  if (attemptCount === 2) {
    return 5;
  }

  return 15;
}

async function processSingleDelivery(delivery: Awaited<ReturnType<typeof claimDueDeliveries>>[number]) {
  const recipient = delivery.notification.recipient;
  const destination = resolveChannelTarget(delivery.channel, recipient);
  const rateLimit = await reserveRateLimitSlot({
    userId: recipient.id,
    channel: delivery.channel,
    limit: getChannelLimit(delivery.channel)
  });

  if (!rateLimit.allowed) {
    await markDeliveryDeferred({
      deliveryId: delivery.id,
      status: DeliveryStatus.RATE_LIMITED,
      availableAt: rateLimit.nextAvailableAt ?? new Date(Date.now() + 60 * 60 * 1000),
      failureMessage: "Rate limit exceeded for this user and channel window."
    });

    await createDeliveryAttempt({
      deliveryId: delivery.id,
      attemptNumber: delivery.attemptCount + 1,
      result: "RATE_LIMITED",
      errorMessage: "Deferred because the user reached the per-channel hourly limit."
    });

    await recomputeNotificationState(delivery.notificationId);
    return {
      deliveryId: delivery.id,
      status: DeliveryStatus.RATE_LIMITED
    };
  }

  try {
    const providerResult = await sendViaChannel({
      channel: delivery.channel,
      destination,
      subject: delivery.renderedSubject,
      body: delivery.renderedBody
    });

    await markDeliverySent({
      deliveryId: delivery.id,
      providerMessageId: providerResult.messageId
    });

    await createDeliveryAttempt({
      deliveryId: delivery.id,
      attemptNumber: delivery.attemptCount + 1,
      result: "SENT",
      responsePayload: providerResult
    });

    await recomputeNotificationState(delivery.notificationId);

    return {
      deliveryId: delivery.id,
      status: DeliveryStatus.SENT
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown delivery failure.";
    const isPermanentFailure = error instanceof ApiError && error.status >= 400 && error.status < 500;
    const nextAttemptCount = delivery.attemptCount + 1;
    const exhausted = nextAttemptCount >= delivery.maxAttempts;

    if (isPermanentFailure || exhausted) {
      await markDeliveryFailed({
        deliveryId: delivery.id,
        failureCode: isPermanentFailure ? "PERMANENT_FAILURE" : "MAX_ATTEMPTS_EXCEEDED",
        failureMessage: errorMessage
      });
    } else {
      const retryAt = new Date();
      retryAt.setMinutes(retryAt.getMinutes() + getRetryDelayMinutes(nextAttemptCount));

      await markDeliveryDeferred({
        deliveryId: delivery.id,
        status: DeliveryStatus.RETRYING,
        availableAt: retryAt,
        failureMessage: errorMessage
      });
    }

    await createDeliveryAttempt({
      deliveryId: delivery.id,
      attemptNumber: nextAttemptCount,
      result: "FAILED",
      errorMessage
    });

    await recomputeNotificationState(delivery.notificationId);

    return {
      deliveryId: delivery.id,
      status: isPermanentFailure || exhausted ? DeliveryStatus.FAILED : DeliveryStatus.RETRYING
    };
  }
}

export async function processDueDeliveries(workerId: string, limit = 10) {
  const deliveries = await claimDueDeliveries(workerId, limit);

  if (deliveries.length === 0) {
    return {
      claimed: 0,
      results: []
    };
  }

  const results = [];

  for (const delivery of deliveries) {
    // ⚠️ SENIOR NOTE: We process sequentially here to keep the example deterministic, but a real worker can parallelize with bounded concurrency once provider and DB pressure are measured.
    results.push(await processSingleDelivery(delivery));
  }

  return {
    claimed: deliveries.length,
    results
  };
}
