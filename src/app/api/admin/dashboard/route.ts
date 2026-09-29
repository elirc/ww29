/*
 * This route returns queue and delivery monitoring data for administrators.
 * It is called by `src/hooks/useAdminDashboard.ts`.
 * It calls `src/lib/auth/session.ts` and `src/services/monitoringService.ts`.
 * A junior engineer often assumes a hidden admin page is enough protection, but this file is where the real access control must fire.
 */
import { requireApiSession } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import { getAdminDashboard } from "@/services/monitoringService";

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request);
    return getAdminDashboard(session);
  });
}
