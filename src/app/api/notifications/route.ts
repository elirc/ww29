/*
 * This route lists notifications for the current user or creates a new batch.
 * It is called by `src/hooks/useNotifications.ts` and `src/components/forms/notification-batch-form.tsx`.
 * It calls auth/session helpers, Zod schemas, and the notification service layer.
 * A junior engineer often lets list and create endpoints drift into inconsistent auth and validation behavior when they share a route file.
 */
import { requireApiSession } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import {
  createNotificationBatchSchema,
  notificationQuerySchema
} from "@/lib/validation/notificationSchemas";
import {
  createNotificationBatchForSession,
  getNotificationComposerData,
  listNotificationsForSession
} from "@/services/notificationService";

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "notifications:view:own");
    const url = new URL(request.url);
    const query = notificationQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const [data, composer] = await Promise.all([
      listNotificationsForSession(session, query),
      getNotificationComposerData()
    ]);

    return {
      ...data,
      composer
    };
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "notifications:create");
    const body = createNotificationBatchSchema.parse(await request.json());
    return createNotificationBatchForSession(session, body);
  });
}
