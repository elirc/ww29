import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("admin dashboard auth enforcement", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("rejects an operator session with 403", async () => {
    // This test matters because hidden admin UI is not a security boundary; the route itself must reject lower roles.
    const { createSessionToken, SESSION_COOKIE } = await import("@/lib/auth/session");
    const { GET } = await import("@/app/api/admin/dashboard/route");
    const token = await createSessionToken({
      userId: "operator-1",
      email: "operator@example.com",
      name: "Ollie Operator",
      role: UserRole.OPERATOR
    });

    const response = await GET(
      new Request("http://localhost/api/admin/dashboard", {
        headers: {
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`
        }
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have permission to perform this action."
    });
  });
});
