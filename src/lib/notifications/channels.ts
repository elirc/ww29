/*
 * This file simulates provider-specific delivery behavior behind a shared interface.
 * It is called by `src/services/workerService.ts` after queue locking and rate-limit checks succeed.
 * It does not call the database; it returns provider-like results that the worker persists.
 * A junior engineer often lets provider concerns leak into business services, which makes retries and testing much harder.
 */
import { NotificationChannel } from "@prisma/client";

import { ApiError } from "@/lib/http/api-errors";

export type ProviderSendInput = {
  channel: NotificationChannel;
  destination: string | null;
  subject: string | null;
  body: string;
};

export type ProviderSendResult = {
  messageId: string;
  preview: string;
};

export async function sendViaChannel({
  channel,
  destination,
  subject,
  body
}: ProviderSendInput): Promise<ProviderSendResult> {
  // ⚠️ SENIOR NOTE: Provider errors are translated into typed app-level failures so retry logic can distinguish permanent rejection from transient outages.
  if (!destination) {
    throw new ApiError(422, `Recipient is missing a ${channel.toLowerCase()} target.`);
  }

  if (body.includes("[[permanent-failure]]")) {
    throw new ApiError(422, "Provider rejected the payload.");
  }

  if (body.includes("[[transient-failure]]")) {
    throw new Error("Temporary provider outage.");
  }

  const suffix = Math.random().toString(36).slice(2, 10);

  return {
    messageId: `${channel.toLowerCase()}-${suffix}`,
    preview: subject ? `${subject} :: ${body.slice(0, 40)}` : body.slice(0, 60)
  };
}
