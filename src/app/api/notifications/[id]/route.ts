/*
 * This route returns the detail view for a single notification.
 * It is called by `src/hooks/useNotificationDetail.ts`.
 * It calls `src/lib/auth/session.ts` and `src/services/notificationService.ts`.
 * A junior engineer often fetches detail records without repeating ownership checks, which creates a data leak even when list endpoints are scoped correctly.
 */
import { requireApiSession } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import { getNotificationDetailForSession } from "@/services/notificationService";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "notifications:view:own");
    const { id } = await context.params;
    return getNotificationDetailForSession(session, id);
  });
}
