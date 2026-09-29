/*
 * This file owns credential verification and session payload shaping.
 * It is called by `src/app/api/auth/login/route.ts` and `src/app/api/auth/me/route.ts`.
 * It calls `src/repositories/userRepository.ts` and `bcryptjs`.
 * A junior engineer often returns the whole user record from auth code, including fields like password hashes that should never leave the backend boundary.
 */
import bcrypt from "bcryptjs";

import { ApiError } from "@/lib/http/api-errors";
import { findUserByEmail, findUserById } from "@/repositories/userRepository";

export async function loginWithPassword(email: string, password: string) {
  const user = await findUserByEmail(email);

  // ⚠️ SENIOR NOTE: The error stays intentionally vague so the login endpoint does not become a user-enumeration side channel.
  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

export async function getCurrentUserProfile(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}
