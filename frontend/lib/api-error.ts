import { toast } from "@/lib/toast";

export const NETWORK_ERROR = "Network error. Check your connection and try again.";

async function readDetail(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    const detail = data?.detail ?? data?.message;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const first = detail.find((item) => item && typeof item.msg === "string");
      if (first?.msg) return String(first.msg);
    }
    return null;
  } catch {
    return null;
  }
}

export async function messageFromResponse(res: Response, fallback: string): Promise<string> {
  const detail = await readDetail(res);
  return detail || fallback;
}

export async function toastIfFailed(res: Response, fallback: string): Promise<boolean> {
  if (res.ok) return false;
  const message = res.status === 403 ? "You don't have permission to do that." : fallback;
  toast.error(await messageFromResponse(res, message));
  return true;
}

export function toastNetworkError() {
  toast.error(NETWORK_ERROR);
}
