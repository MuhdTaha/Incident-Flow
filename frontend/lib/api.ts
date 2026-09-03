import { supabase } from "@/lib/supabase";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Resolve the API base URL.
 * A frontend/.env copied from production often still has the Render URL. When
 * the UI is opened on localhost, always use the local API so invites hit
 * Mailhog instead of the live workspace.
 */
export function getApiUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) {
    if (!configured || !/(localhost|127\.0\.0\.1)/.test(configured)) {
      return "http://localhost:8000/api/v1";
    }
  }
  if (configured) return configured;
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL || "http://backend:8000/api/v1";
  }
  return "http://localhost:8000/api/v1";
}

export const API_URL = getApiUrl();

export async function authFetch(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    console.warn("No active session found during authFetch");
    throw new Error("No active session");
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(`${getApiUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  return res;
}
