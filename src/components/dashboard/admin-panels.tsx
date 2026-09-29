"use client";

type DashboardData = {
  deliveryCounts: Array<{ status: string; _count: { _all: number } }>;
  recentFailures: Array<any>;
  recentBatches: Array<any>;
  staleProcessingCount: number;
};

export function AdminPanels({ data }: { data: DashboardData }) {
  const deliveryCards = Object.entries(
    Object.fromEntries(
      data.deliveryCounts.map((entry) => [entry.status, entry._count._all])
    )
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {deliveryCards.map(([status, count]) => (
          <div
            key={status}
            className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-panel"
          >
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Delivery status
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">{status}</div>
            <div className="mt-2 text-3xl font-semibold text-ink">{String(count)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          <h2 className="font-display text-2xl font-semibold">Recent failures</h2>
          <div className="mt-4 space-y-4">
            {data.recentFailures.map((failure) => (
              <div key={failure.id} className="rounded-3xl border border-slate-200 px-4 py-4">
                <div className="font-medium">{failure.notification.batch.name}</div>
                <div className="text-sm text-slate-500">
                  {failure.notification.recipient.name} · {failure.channel}
                </div>
                <div className="mt-2 text-sm text-danger">
                  {failure.failureMessage ?? "No failure message recorded."}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          <h2 className="font-display text-2xl font-semibold">Recent batches</h2>
          <div className="mt-4 space-y-4">
            {data.recentBatches.map((batch) => (
              <div key={batch.id} className="rounded-3xl border border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{batch.name}</div>
                  <div className="rounded-full bg-surf px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    {batch.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {batch.recipientCount} recipients · created by {batch.createdBy.name}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-3xl bg-ink px-5 py-4 text-white">
            <div className="text-xs uppercase tracking-[0.25em] text-white/60">
              Stale processing leases
            </div>
            <div className="mt-2 text-3xl font-semibold">{data.staleProcessingCount}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
