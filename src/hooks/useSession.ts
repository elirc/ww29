"use client";

import { useQuery } from "@tanstack/react-query";

type SessionResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "OPERATOR" | "VIEWER";
  } | null;
};

async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch("/api/auth/me", {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Failed to load session.");
  }

  return response.json();
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession
  });
}
