/*
 * This file owns cookie-based session creation and request-level session verification.
 * It is called by auth routes under `src/app/api/auth/` and by protected API handlers across `src/app/api/`.
 * It calls `jose` for signing, `src/lib/env.ts` for secrets, and `src/lib/auth/permissions.ts` for permission enforcement.
 * A junior engineer would likely trust client-submitted role data instead of signing and verifying the session payload server-side.
 */
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { UserRole } from "@prisma/client";

import { env } from "@/lib/env";
import { requireAction, type AppAction } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/api-errors";

export const SESSION_COOKIE = "notification_session";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
};

type SessionPayload = SessionUser & JWTPayload;

const encoder = new TextEncoder();

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(env.SESSION_SECRET));
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(
      token,
      encoder.encode(env.SESSION_SECRET)
    );

    if (!payload.userId || !payload.role || !payload.email || !payload.name) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      name: payload.name
    };
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${key}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export async function getSessionFromRequest(request: Request) {
  const token = readCookieValue(request.headers.get("cookie"), SESSION_COOKIE);

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireApiSession(request: Request, action?: AppAction) {
  const session = await getSessionFromRequest(request);

  // ⚠️ SENIOR NOTE: Reject before business logic runs so protected services never have to reason about an unauthenticated caller shape.
  if (!session) {
    throw new ApiError(401, "Authentication required.");
  }

  if (action) {
    requireAction(session.role, action);
  }

  return session;
}

export function buildSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
