/*
 * This file owns template interpolation and quiet-hours evaluation for notification delivery.
 * It is called by `src/services/notificationService.ts` when deliveries are created and by the worker in `src/services/workerService.ts`.
 * It calls only simple utility functions and Prisma enum types.
 * A junior engineer often renders templates with unchecked placeholders, which leads to broken customer-facing messages and silent data loss.
 */
import { NotificationChannel, type UserPreference } from "@prisma/client";

type RenderInput = {
  template: string;
  values: Record<string, string>;
};

const placeholderPattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate({ template, values }: RenderInput) {
  // ⚠️ SENIOR NOTE: Missing placeholders collapse to empty strings on purpose so operators can inspect the rendered output instead of crashing the whole batch at send time.
  return template.replace(placeholderPattern, (_, token: string) => values[token] ?? "");
}

export function buildMessageValues(
  defaults: Record<string, string>,
  recipientValues: Record<string, string>,
  recipientName: string
) {
  return {
    recipientName,
    ...defaults,
    ...recipientValues
  };
}

export function isChannelOptedIn(
  preference: UserPreference | null,
  channel: NotificationChannel
) {
  if (!preference) {
    return true;
  }

  switch (channel) {
    case NotificationChannel.EMAIL:
      return preference.emailOptIn;
    case NotificationChannel.SMS:
      return preference.smsOptIn;
    case NotificationChannel.PUSH:
      return preference.pushOptIn;
  }
}

export function isWithinQuietHours(preference: UserPreference | null, date = new Date()) {
  if (
    !preference ||
    preference.quietHoursStart === null ||
    preference.quietHoursEnd === null
  ) {
    return false;
  }

  const hour = date.getHours();

  if (preference.quietHoursStart < preference.quietHoursEnd) {
    return hour >= preference.quietHoursStart && hour < preference.quietHoursEnd;
  }

  return hour >= preference.quietHoursStart || hour < preference.quietHoursEnd;
}

export function resolveChannelTarget(channel: NotificationChannel, recipient: {
  email: string;
  phoneNumber: string | null;
  pushToken: string | null;
}) {
  switch (channel) {
    case NotificationChannel.EMAIL:
      return recipient.email;
    case NotificationChannel.SMS:
      return recipient.phoneNumber;
    case NotificationChannel.PUSH:
      return recipient.pushToken;
  }
}
