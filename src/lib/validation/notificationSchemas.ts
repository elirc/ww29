/*
 * This file defines the request validation boundary for notification creation and filtering.
 * It is called by `src/app/api/notifications/route.ts` and keeps shape validation out of service code.
 * It calls only Zod.
 * A junior engineer often validates arrays and enums but forgets cross-field rules like "template or raw content must exist", which produces half-defined jobs.
 */
import { NotificationChannel } from "@prisma/client";
import { z } from "zod";

const channelSchema = z.enum(NotificationChannel);

export const notificationQuerySchema = z.object({
  mine: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  status: z.string().optional()
});

export const createNotificationBatchSchema = z
  .object({
    name: z.string().min(3).max(80),
    templateId: z.string().cuid().nullable(),
    recipientUserIds: z.array(z.string().cuid()).min(1).max(50),
    channels: z.array(channelSchema).min(1),
    scheduledFor: z.string().datetime().nullable(),
    subject: z.string().max(140).nullable(),
    body: z.string().max(5000).nullable(),
    personalizationDefaults: z.record(z.string(), z.string()).default({}),
    recipientData: z
      .array(
        z.object({
          userId: z.string().cuid(),
          values: z.record(z.string(), z.string()).default({})
        })
      )
      .default([])
  })
  .superRefine((value, context) => {
    // ⚠️ SENIOR NOTE: This cross-field guard belongs at the boundary because downstream queue code assumes the message is already fully defined.
    if (!value.templateId && !value.body) {
      context.addIssue({
        code: "custom",
        message: "Provide either a templateId or raw body content."
      });
    }

    if (value.channels.includes(NotificationChannel.EMAIL) && !value.templateId && !value.subject) {
      context.addIssue({
        code: "custom",
        message: "Email notifications need a subject when no template is used."
      });
    }
  });

export const openNotificationSchema = z.object({
  notificationId: z.string().cuid()
});

export type CreateNotificationBatchInput = z.infer<typeof createNotificationBatchSchema>;
