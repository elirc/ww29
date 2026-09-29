"use client";

import { FormEvent, useEffect, useState } from "react";

import type { PreferenceFormPayload } from "@/hooks/usePreferences";

export function PreferenceForm({
  initialValues,
  onSubmit,
  isSubmitting
}: {
  initialValues: PreferenceFormPayload;
  onSubmit: (payload: PreferenceFormPayload) => Promise<void> | void;
  isSubmitting: boolean;
}) {
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel"
    >
      <h2 className="font-display text-2xl font-semibold">Preference controls</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        These values directly shape eligibility inside the delivery workflow before the
        worker sends or skips a channel.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(["emailOptIn", "smsOptIn", "pushOptIn"] as const).map((key) => (
          <label
            key={key}
            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{key}</span>
              <input
                type="checkbox"
                checked={Boolean(values[key])}
                onChange={() =>
                  setValues((current) => ({
                    ...current,
                    [key]: !current[key]
                  }))
                }
              />
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Quiet hours start
          </label>
          <input
            type="number"
            min={0}
            max={23}
            value={values.quietHoursStart ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                quietHoursStart:
                  event.target.value === "" ? null : Number(event.target.value)
              }))
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Quiet hours end
          </label>
          <input
            type="number"
            min={0}
            max={23}
            value={values.quietHoursEnd ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                quietHoursEnd:
                  event.target.value === "" ? null : Number(event.target.value)
              }))
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 rounded-full bg-ink px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save preferences"}
      </button>
    </form>
  );
}
