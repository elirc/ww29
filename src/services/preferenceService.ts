/*
 * This file owns business rules for reading and updating a user's delivery preferences.
 * It is called by `src/app/api/preferences/route.ts`.
 * It calls `src/repositories/preferenceRepository.ts`, `src/repositories/userRepository.ts`, and `src/repositories/auditLogRepository.ts`.
 * A junior engineer often updates preference rows without first verifying the user exists, which leads to confusing integrity errors and weaker API semantics.
 */
import type { SessionUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/api-errors";
import type { PreferenceUpdateInput } from "@/lib/validation/preferenceSchemas";
import { createAuditLog } from "@/repositories/auditLogRepository";
import {
  getPreferenceForUser,
  upsertPreferenceForUser
} from "@/repositories/preferenceRepository";
import { findUserById } from "@/repositories/userRepository";

export async function getMyPreferences(session: SessionUser) {
  const [user, preference] = await Promise.all([
    findUserById(session.userId),
    getPreferenceForUser(session.userId)
  ]);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    preferences:
      preference ?? {
        emailOptIn: true,
        smsOptIn: false,
        pushOptIn: true,
        quietHoursStart: null,
        quietHoursEnd: null
      }
  };
}

export async function updateMyPreferences(
  session: SessionUser,
  input: PreferenceUpdateInput
) {
  const user = await findUserById(session.userId);

  // ⚠️ SENIOR NOTE: We verify the owning user first so API callers get a precise domain error instead of a lower-level relational failure.
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const preference = await upsertPreferenceForUser(session.userId, input);

  await createAuditLog({
    actorUserId: session.userId,
    action: "preferences.updated",
    entityType: "UserPreference",
    entityId: preference.id,
    payload: input
  });

  return {
    preferences: preference
  };
}
