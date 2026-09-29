"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type NotificationsResponse = {
  notifications: Array<{
    id: string;
    status: string;
    createdAt: string;
    recipient: { name: string; email: string };
    batch: { name: string; status: string };
    deliveries: Array<{
      id: string;
      channel: string;
      status: string;
      sentAt: string | null;
      openedAt: string | null;
      failureMessage: string | null;
    }>;
  }>;
  composer: {
    templates: Array<{
      id: string;
      name: string;
      channel: string;
      description: string | null;
    }>;
    recipients: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>;
  };
};

export type CreateBatchPayload = {
  name: string;
  templateId: string | null;
  recipientUserIds: string[];
  channels: Array<"EMAIL" | "SMS" | "PUSH">;
  scheduledFor: string | null;
  subject: string | null;
  body: string | null;
  personalizationDefaults: Record<string, string>;
  recipientData: Array<{
    userId: string;
    values: Record<string, string>;
  }>;
};

async function fetchNotifications(mine: boolean): Promise<NotificationsResponse> {
  const response = await fetch(`/api/notifications?mine=${mine}`, {
    credentials: "include"
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error ?? "Failed to load notifications.");
  }

  return response.json();
}

export function useNotifications(mine: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", mine],
    queryFn: () => fetchNotifications(mine)
  });

  const createBatch = useMutation({
    mutationFn: async (payload: CreateBatchPayload) => {
      const response = await fetch("/api/notifications", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create notification batch.");
      }

      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markOpened = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/open`, {
        method: "POST",
        credentials: "include"
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to mark notification as opened.");
      }

      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return {
    ...query,
    createBatch,
    markOpened
  };
}
