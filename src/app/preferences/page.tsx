"use client";

import { PreferenceForm } from "@/components/forms/preference-form";
import { AppShell } from "@/components/layout/app-shell";
import { usePreferences } from "@/hooks/usePreferences";
import { useSession } from "@/hooks/useSession";

export default function PreferencesPage() {
  const session = useSession();
  const preferences = usePreferences();

  return (
    <AppShell
      title="Preference Center"
      description="Manage opt-in state and quiet hours that the queue respects before dispatching each channel."
    >
      {!session.data?.user ? (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          Sign in to manage delivery preferences.
        </div>
      ) : preferences.data ? (
        <PreferenceForm
          initialValues={preferences.data.preferences}
          isSubmitting={preferences.updatePreferences.isPending}
          onSubmit={async (payload) => {
            await preferences.updatePreferences.mutateAsync(payload);
          }}
        />
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
          Loading preferences...
        </div>
      )}
    </AppShell>
  );
}
