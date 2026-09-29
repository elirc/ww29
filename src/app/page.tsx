import Link from "next/link";

const credentials = [
  { role: "Admin", email: "admin@example.com", password: "Password123!" },
  { role: "Operator", email: "operator@example.com", password: "Password123!" },
  { role: "Viewer", email: "viewer@example.com", password: "Password123!" }
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-panel backdrop-blur">
          <div className="font-display text-sm uppercase tracking-[0.35em] text-signal">
            Async workflows + reliability
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Build and monitor notification delivery across email, SMS, and push.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            This project demonstrates a production-style TypeScript stack with a
            Postgres-backed delivery queue, retry semantics, delivery history, opt-in
            preferences, rate limiting, and role-aware admin monitoring.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-ink px-5 py-3 font-medium text-white transition hover:opacity-90"
            >
              Log in
            </Link>
            <Link
              href="/notifications"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 transition hover:border-slate-300"
            >
              Explore the app
            </Link>
          </div>
        </section>

        <section className="rounded-[32px] border border-ink/10 bg-ink p-8 text-white shadow-panel">
          <div className="text-sm uppercase tracking-[0.3em] text-white/60">
            Seeded users
          </div>
          <div className="mt-6 space-y-4">
            {credentials.map((credential) => (
              <div
                key={credential.role}
                className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <div className="font-display text-xl font-semibold">
                  {credential.role}
                </div>
                <div className="mt-2 text-sm text-white/70">{credential.email}</div>
                <div className="text-sm text-white/70">{credential.password}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
