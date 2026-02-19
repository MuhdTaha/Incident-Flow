import { supabase } from "@/lib/supabase";

// 1. Determine if we are running on the Server (Docker) or Client (Browser)
const isServer = typeof window === 'undefined';

// 2. Select the correct Base URL
// - Server: Talk directly to the "backend" container (internal Docker DNS)
// - Client: Talk to "localhost" (your browser's network)
const API_URL = isServer
  ? process.env.INTERNAL_API_URL || "http://backend:8000/api/v1"
  : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export { API_URL };

export async function authFetch(endpoint: string, options: RequestInit = {}) {
  // 3. Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Note: On the Server (SSR), 'session' might be null here because 
  // 'supabase' relies on browser localStorage. 
  if (!token) {
    // Optional: Handle missing token gracefully depending on your needs
    console.warn("No active session found during authFetch");
    throw new Error("No active session");
  }

  // 4. Merge headers
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {}),
  };

  // 5. Perform request using the dynamic API_URL
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return res;
}