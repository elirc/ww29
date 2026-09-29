"use client";

import { NotificationBatchForm } from "@/components/forms/notification-batch-form";
import { AppShell } from "@/components/layout/app-shell";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "@/hooks/useSession";

function badgeClasses(status: string) {
  if (status === "FAILED") {
    return "bg-danger/10 text-danger";
  }

  if (status === "SENT" || status === "COMPLETED" || status === "OPENED") {
    return "bg-signal/10 text-signal";
  }

  return "bg-surf text-slate-600";
}

export default function NotificationsPage() {
  const session = useSession();
  const mine = session.data?.user?.role === "VIEWER";
  const notifications = useNotifications(Boolean(mine));

  return (
    <AppShell
      title="Notification Workbench"
      description="Create queued notification batches, inspect per-channel delivery history, and simulate open tracking from the same workflow."
    >
      {!session.data?.user ? (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          Sign in to create or inspect notifications.
        </div>
      ) : (
        <>
          {(session.data.user.role === "ADMIN" || session.data.user.role === "OPERATOR") &&
          notifications.data ? (
            <NotificationBatchForm
              templates={notifications.data.composer.templates}
              recipients={notifications.data.composer.recipients}
              isSubmitting={notifications.createBatch.isPending}
              onSubmit={async (payload) => {
                await notifications.createBatch.mutateAsync(payload);
              }}
            />
          ) : null}

          <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Delivery history
                </h2>
                <p className="text-sm text-slate-500">
                  Viewers are scoped to their own notifications. Operators and admins can
                  inspect the broader queue surface.
                </p>
              </div>
              <div className="rounded-full bg-surf px-4 py-2 text-sm text-slate-600">
                {notifications.data?.notifications.length ?? 0} notifications
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {notifications.data?.notifications.map((notification) => {
                const hasSentDelivery = notification.deliveries.some(
                  (delivery) => delivery.status === "SENT"
                );

                return (
                  <article
                    key={notification.id}
                    className="rounded-[28px] border border-slate-200 px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-display text-xl font-semibold">
                            {notification.batch.name}
                          </h3>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${badgeClasses(notification.status)}`}
                          >
                            {notification.status}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                          Recipient: {notification.recipient.name} ({notification.recipient.email})
                        </div>
                      </div>

                      {hasSentDelivery ? (
                        <button
                          type="button"
                          onClick={() => notifications.markOpened.mutate(notification.id)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                        >
                          Mark as opened
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {notification.deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="rounded-3xl bg-slate-50 px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">{delivery.channel}</div>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] ${badgeClasses(delivery.status)}`}
                            >
                              {delivery.status}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-500">
                            {delivery.failureMessage ?? "Ready for async delivery monitoring."}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
