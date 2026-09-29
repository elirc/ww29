import { describe, expect, it } from "vitest";

import { createNotificationBatchSchema } from "@/lib/validation/notificationSchemas";

describe("notification schema validation", () => {
  it("rejects an email batch without a subject when no template is provided", () => {
    // This test matters because message-shape bugs should stop at the API boundary instead of producing half-formed queue records.
    expect(() =>
      createNotificationBatchSchema.parse({
        name: "Broken batch",
        templateId: null,
        recipientUserIds: ["cm11111111111111111111111"],
        channels: ["EMAIL"],
        scheduledFor: null,
        subject: null,
        body: "Hello {{recipientName}}",
        personalizationDefaults: {},
        recipientData: []
      })
    ).toThrowError(/Email notifications need a subject/i);
  });
});
