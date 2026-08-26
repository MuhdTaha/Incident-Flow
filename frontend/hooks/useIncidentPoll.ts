import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

/**
 * Re-fetch incidents on an interval. App data lives in our Postgres, not
 * Supabase Realtime — this is polling, not a live subscription.
 */
export function useIncidentPoll(fetcher: () => Promise<void>, enabled: boolean) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    await fetcherRef.current();
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { lastUpdated, refresh };
}
