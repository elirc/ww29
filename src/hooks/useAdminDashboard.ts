"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchDashboard() {
  const response = await fetch("/api/admin/dashboard", {
    credentials: "include"
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Failed to load admin dashboard.");
  }

  return body;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard
  });
}
