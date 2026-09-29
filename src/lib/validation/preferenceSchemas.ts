/*
 * This file defines the API validation boundary for user preference updates.
 * It is called by `src/app/api/preferences/route.ts` before preference service logic runs.
 * It only calls Zod.
 * A junior engineer often forgets to validate cross-field time windows, which lets impossible quiet-hour ranges sneak into the database.
 */
import { z } from "zod";

export const preferenceUpdateSchema = z
  .object({
    emailOptIn: z.boolean(),
    smsOptIn: z.boolean(),
    pushOptIn: z.boolean(),
    quietHoursStart: z.number().int().min(0).max(23).nullable(),
    quietHoursEnd: z.number().int().min(0).max(23).nullable()
  })
  .superRefine((value, context) => {
    const bothNull = value.quietHoursStart === null && value.quietHoursEnd === null;
    const bothPresent =
      value.quietHoursStart !== null && value.quietHoursEnd !== null;

    // ⚠️ SENIOR NOTE: Partial quiet-hour ranges are a classic "looked fine in the UI" bug that leaves downstream scheduling code with ambiguous state.
    if (!bothNull && !bothPresent) {
      context.addIssue({
        code: "custom",
        message: "Quiet hours must include both a start and end hour."
      });
    }

    if (bothPresent && value.quietHoursStart === value.quietHoursEnd) {
      context.addIssue({
        code: "custom",
        message: "Quiet hours must cover a real range."
      });
    }
  });

export type PreferenceUpdateInput = z.infer<typeof preferenceUpdateSchema>;
