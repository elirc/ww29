/*
 * This route returns the authenticated user's profile if a valid session cookie is present.
 * It is called by `src/hooks/useSession.ts`.
 * It calls `src/lib/auth/session.ts` and `src/services/authService.ts`.
 * A junior engineer often forces `/me` to hard-fail when logged out, which makes basic client bootstrapping noisier than it needs to be.
 */
import { getSessionFromRequest } from "@/lib/auth/session";
import { apiResponse, withRouteErrorHandling } from "@/lib/http/api-errors";
import { getCurrentUserProfile } from "@/services/authService";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return apiResponse({ user: null });
  }

  return withRouteErrorHandling(async () => ({
    user: await getCurrentUserProfile(session.userId)
  }));
}
