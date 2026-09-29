"use client";

import { FormEvent, useMemo, useState } from "react";

import type { CreateBatchPayload } from "@/hooks/useNotifications";

type Template = {
  id: string;
  name: string;
  channel: string;
  description: string | null;
};

type Recipient = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const channels = ["EMAIL", "SMS", "PUSH"] as const;

export function NotificationBatchForm({
  templates,
  recipients,
  onSubmit,
  isSubmitting
}: {
  templates: Template[];
  recipients: Recipient[];
  onSubmit: (payload: CreateBatchPayload) => Promise<void> | void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("Product Rollout");
  const [templateId, setTemplateId] = useState<string>("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Array<(typeof channels)[number]>>([
    "EMAIL"
  ]);
  const [subject, setSubject] = useState("Release update for {{recipientName}}");
  const [body, setBody] = useState(
    "Hi {{recipientName}}, {{featureName}} is ready for you. {{callToAction}}"
  );
  const [featureName, setFeatureName] = useState("Notification Analytics");
  const [callToAction, setCallToAction] = useState(
    "Open the dashboard to review delivery health."
  );
  const [scheduledFor, setScheduledFor] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates]
  );

  function toggleRecipient(recipientId: string) {
    setSelectedRecipients((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId]
    );
  }

  function toggleChannel(channel: (typeof channels)[number]) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name,
      templateId: templateId || null,
      recipientUserIds: selectedRecipients,
      channels: selectedChannels,
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      subject: templateId ? null : subject,
      body: templateId ? null : body,
      personalizationDefaults: {
        featureName,
        callToAction,
        message: body
      },
      recipientData: []
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Batch name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Template
          </label>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
          >
            <option value="">No template, use raw content</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.channel})
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <p className="mt-2 text-sm text-slate-500">{selectedTemplate.description}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Personalization: featureName
            </label>
            <input
              value={featureName}
              onChange={(event) => setFeatureName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Personalization: callToAction
            </label>
            <input
              value={callToAction}
              onChange={(event) => setCallToAction(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={Boolean(templateId)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition disabled:bg-slate-50 focus:border-signal"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Schedule time
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-signal"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Body</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={Boolean(templateId)}
            rows={5}
            className="w-full rounded-3xl border border-slate-200 px-4 py-3 outline-none transition disabled:bg-slate-50 focus:border-signal"
          />
        </div>

        <div>
          <div className="mb-3 text-sm font-medium text-slate-700">Channels</div>
          <div className="flex flex-wrap gap-3">
            {channels.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                {channel}
              </label>
            ))}
          </div>
          {templateId ? (
            <p className="mt-2 text-xs text-amber">
              Template batches must use one channel so the rendered content stays explicit.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-signal px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Queueing batch..." : "Queue notification batch"}
        </button>
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Recipients</h2>
            <p className="text-sm text-slate-500">
              Select up to 50 users for this batch request.
            </p>
          </div>
          <div className="rounded-full bg-surf px-4 py-2 text-sm font-medium text-slate-600">
            {selectedRecipients.length} selected
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {recipients.map((recipient) => (
            <label
              key={recipient.id}
              className="flex items-start gap-3 rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-signal/40"
            >
              <input
                type="checkbox"
                checked={selectedRecipients.includes(recipient.id)}
                onChange={() => toggleRecipient(recipient.id)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{recipient.name}</div>
                <div className="text-sm text-slate-500">{recipient.email}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {recipient.role}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </form>
  );
}
