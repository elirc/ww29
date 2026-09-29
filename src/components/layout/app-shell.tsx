"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import { useSession } from "@/hooks/useSession";

const navItems: Array<{
  href: Route;
  label: string;
  adminOnly?: boolean;
}> = [
  { href: "/notifications", label: "Notifications" },
  { href: "/preferences", label: "Preferences" },
  { href: "/admin", label: "Admin", adminOnly: true }
];

export function AppShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();

  const logout = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/login");
    }
  });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/" className="font-display text-xs uppercase tracking-[0.3em] text-signal">
                Notification Delivery Platform
              </Link>
              <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                {description}
              </p>
            </div>
            <div className="rounded-3xl bg-ink px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">
                Signed in as
              </div>
              <div className="mt-2 font-semibold">
                {session.data?.user?.name ?? "Guest"}
              </div>
              <div className="text-sm text-white/70">
                {session.data?.user?.email ?? "Not authenticated"}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {session.data?.user?.role ?? "PUBLIC"}
              </div>
              {session.data?.user ? (
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm transition hover:border-white/40 hover:bg-white/10"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm transition hover:border-white/40 hover:bg-white/10"
                >
                  Go to login
                </Link>
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-3">
          {navItems
            .filter((item) => !item.adminOnly || session.data?.user?.role === "ADMIN")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  pathname === item.href
                    ? "bg-ink text-white"
                    : "border border-slate-200 bg-white/75 text-slate-700 hover:border-slate-300 hover:bg-white"
                )}
              >
                {item.label}
              </Link>
            ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
