/*
 * This route records an "opened" engagement event for a notification.
 * It is called by `src/hooks/useNotifications.ts` from the viewer-facing list.
 * It calls `src/lib/auth/session.ts` and `src/services/notificationService.ts`.
 * A junior engineer often treats engagement tracking as harmless analytics, but it is still a state transition that needs ownership and transition validation.
 */
import { requireApiSession } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import { markNotificationOpenedForSession } from "@/services/notificationService";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "notifications:open:own");
    const { id } = await context.params;
    return markNotificationOpenedForSession(session, id);
  });
}
