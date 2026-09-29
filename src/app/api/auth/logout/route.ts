/*
 * This route clears the session cookie on logout.
 * It is called by `src/components/layout/app-shell.tsx`.
 * It calls `src/lib/auth/session.ts`.
 * A junior engineer often removes client state but forgets to expire the server cookie, leaving the session active.
 */
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  return new Response(
    JSON.stringify({
      success: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}
