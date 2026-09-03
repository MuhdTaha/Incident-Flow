import { getApiUrl } from "@/lib/api";

export const OPEN_INVITE_FLAG = "incidentflow:openInvite";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

function paramsFromLocation(): URLSearchParams {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const fromHash = new URLSearchParams(hash);
  const fromQuery = new URLSearchParams(window.location.search);
  const merged = new URLSearchParams(fromQuery);
  fromHash.forEach((value, key) => {
    if (!merged.get(key)) merged.set(key, value);
  });
  return merged;
}

export function decodeJwtEmail(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { email?: unknown };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export function peekAuthTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const params = paramsFromLocation();
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function peekAuthCode(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("code");
}

export function stripAuthParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  ["code", "access_token", "refresh_token", "type", "expires_in", "expires_at", "token_type"].forEach(
    (key) => url.searchParams.delete(key),
  );
  url.hash = "";
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

export function markOpenInviteDialog(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OPEN_INVITE_FLAG, "1");
}

export function consumeOpenInviteFlag(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("invite") === "1";
  const fromStore = sessionStorage.getItem(OPEN_INVITE_FLAG) === "1";
  if (fromQuery) sessionStorage.setItem(OPEN_INVITE_FLAG, "1");
  if (!fromQuery && !fromStore) return false;
  sessionStorage.removeItem(OPEN_INVITE_FLAG);
  return true;
}

export async function hasWorkspace(accessToken: string): Promise<boolean> {
  const res = await fetch(`${getApiUrl()}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

export async function fetchCurrentProfile(accessToken: string): Promise<{
  invite_pending?: boolean;
} | null> {
  const res = await fetch(`${getApiUrl()}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
