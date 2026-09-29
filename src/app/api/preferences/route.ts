/*
 * This route exposes the authenticated user's preference read and update operations.
 * It is called by `src/hooks/usePreferences.ts`.
 * It calls `src/lib/auth/session.ts`, `src/lib/validation/preferenceSchemas.ts`, and `src/services/preferenceService.ts`.
 * A junior engineer often trusts client-side forms for preference validation, which leaves the real API boundary unprotected.
 */
import { requireApiSession } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import { preferenceUpdateSchema } from "@/lib/validation/preferenceSchemas";
import {
  getMyPreferences,
  updateMyPreferences
} from "@/services/preferenceService";

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "preferences:manage:own");
    return getMyPreferences(session);
  });
}

export async function PUT(request: Request) {
  return withRouteErrorHandling(async () => {
    const session = await requireApiSession(request, "preferences:manage:own");
    const body = preferenceUpdateSchema.parse(await request.json());
    return updateMyPreferences(session, body);
  });
}
