/*
 * This file shapes the admin monitoring read model and enforces the admin-only boundary.
 * It is called by `src/app/api/admin/dashboard/route.ts`.
 * It calls `src/lib/auth/permissions.ts` and `src/repositories/dashboardRepository.ts`.
 * A junior engineer often assumes dashboard routes are safe because the UI hides them, but server-side role checks are the real enforcement point.
 */
import type { SessionUser } from "@/lib/auth/session";
import { requireAction } from "@/lib/auth/permissions";
import { getDashboardSnapshot } from "@/repositories/dashboardRepository";

export async function getAdminDashboard(session: SessionUser) {
  // ⚠️ SENIOR NOTE: Read-only admin routes still need role enforcement because monitoring data often reveals more than the product UI itself.
  requireAction(session.role, "dashboard:view:admin");
  return getDashboardSnapshot();
}
