"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PreferenceFormPayload = {
  emailOptIn: boolean;
  smsOptIn: boolean;
  pushOptIn: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

async function fetchPreferences() {
  const response = await fetch("/api/preferences", {
    credentials: "include"
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Failed to load preferences.");
  }

  return body;
}

export function usePreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences
  });

  const updatePreferences = useMutation({
    mutationFn: async (payload: PreferenceFormPayload) => {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to update preferences.");
      }

      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return {
    ...query,
    updatePreferences
  };
}
