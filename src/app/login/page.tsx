import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-panel">
          <div className="font-display text-sm uppercase tracking-[0.35em] text-signal">
            Sign in
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            Authenticate into the delivery platform.
          </h1>
          <p className="mt-3 text-slate-600">
            The backend uses signed HTTP-only session cookies and role-based access
            control. Start with one of the seeded accounts from the home page.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
          <Link href="/" className="mt-5 inline-flex text-sm text-slate-500 hover:text-slate-700">
            Back to project overview
          </Link>
        </section>

        <section className="rounded-[32px] border border-ink/10 bg-ink p-8 text-white shadow-panel">
          <div className="text-sm uppercase tracking-[0.3em] text-white/60">
            What you can test
          </div>
          <div className="mt-6 space-y-4 text-sm text-white/75">
            <p>Create a multi-recipient notification batch and inspect how each channel gets its own delivery record.</p>
            <p>Update user preferences to see opt-out and quiet-hours rules affect eligibility before the worker sends anything.</p>
            <p>Use the admin account to monitor failures, queue state, and stale processing leases.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
