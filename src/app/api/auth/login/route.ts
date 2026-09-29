/*
 * This route handles credential login and writes the signed session cookie.
 * It is called by the login form in `src/components/forms/login-form.tsx`.
 * It calls `src/lib/validation/authSchemas.ts`, `src/services/authService.ts`, and `src/lib/auth/session.ts`.
 * A junior engineer often authenticates users correctly but forgets to set secure, server-generated session state in the response.
 */
import { buildSessionCookie, createSessionToken } from "@/lib/auth/session";
import { withRouteErrorHandling } from "@/lib/http/api-errors";
import { loginSchema } from "@/lib/validation/authSchemas";
import { loginWithPassword } from "@/services/authService";

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const body = loginSchema.parse(await request.json());
    const sessionUser = await loginWithPassword(body.email, body.password);
    const token = await createSessionToken(sessionUser);

    return new Response(
      JSON.stringify({
        user: sessionUser
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildSessionCookie(token)
        }
      }
    );
  });
}
