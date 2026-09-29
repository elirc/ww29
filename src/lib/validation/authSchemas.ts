/*
 * This file defines the auth input boundary for login requests.
 * It is called by `src/app/api/auth/login/route.ts` before auth service logic runs.
 * It only calls Zod.
 * A junior engineer often validates presence but forgets normalization, which leads to duplicate identity records like mixed-case emails.
 */
import { z } from "zod";

export const loginSchema = z.object({
  // ⚠️ SENIOR NOTE: Normalizing email here prevents subtle auth bugs where the database treats mixed-case logins differently from the UI.
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8)
});

export type LoginInput = z.infer<typeof loginSchema>;
