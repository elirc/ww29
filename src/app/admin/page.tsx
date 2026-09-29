"use client";

import { AdminPanels } from "@/components/dashboard/admin-panels";
import { AppShell } from "@/components/layout/app-shell";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useSession } from "@/hooks/useSession";

export default function AdminPage() {
  const session = useSession();
  const dashboard = useAdminDashboard();

  return (
    <AppShell
      title="Admin Monitoring"
      description="Watch queue health, failed deliveries, and batch-level status trends from a single read model."
    >
      {session.data?.user?.role !== "ADMIN" ? (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          This dashboard is restricted to administrators.
        </div>
      ) : dashboard.data ? (
        <AdminPanels data={dashboard.data} />
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          Loading dashboard...
        </div>
      )}
    </AppShell>
  );
}
