/*
 * This file defines the application's RBAC matrix and central permission helpers.
 * It is called by route handlers under `src/app/api/` and by services such as `src/services/notificationService.ts`.
 * It does not call external modules beyond enum types and the shared `ApiError`.
 * A junior engineer often hard-codes role checks inline in routes, which makes authorization inconsistent and hard to review.
 */
import { UserRole } from "@prisma/client";

import { ApiError } from "@/lib/http/api-errors";

export type AppAction =
  | "notifications:create"
  | "notifications:view:any"
  | "notifications:view:own"
  | "notifications:open:own"
  | "preferences:manage:own"
  | "dashboard:view:admin";

const rolePermissions: Record<UserRole, AppAction[]> = {
  ADMIN: [
    "notifications:create",
    "notifications:view:any",
    "notifications:view:own",
    "notifications:open:own",
    "preferences:manage:own",
    "dashboard:view:admin"
  ],
  OPERATOR: [
    "notifications:create",
    "notifications:view:any",
    "notifications:view:own",
    "notifications:open:own",
    "preferences:manage:own"
  ],
  VIEWER: [
    "notifications:view:own",
    "notifications:open:own",
    "preferences:manage:own"
  ]
};

export function can(role: UserRole, action: AppAction) {
  return rolePermissions[role].includes(action);
}

export function requireAction(role: UserRole, action: AppAction) {
  // ⚠️ SENIOR NOTE: Centralizing this throw keeps permission failures uniform; scattered role checks are where "one unguarded endpoint" bugs usually come from.
  if (!can(role, action)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}
