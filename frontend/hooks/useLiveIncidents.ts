import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useLiveIncidents(setIncidents: React.Dispatch<React.SetStateAction<any[]>>) {
  useEffect(() => {
    // 1. Create a channel to listen to the 'incidents' table
    const incidentChannel = supabase
      .channel("custom-incidents-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload) => {
          console.log("Realtime payload received!", payload);

          setIncidents((currentIncidents) => {
            // Handle an UPDATE (e.g., status changed to RESOLVED)
            if (payload.eventType === "UPDATE") {
              return currentIncidents.map((inc) =>
                inc.id === payload.new.id ? { ...inc, ...payload.new } : inc
              );
            }
            // Handle an INSERT (e.g., brand new incident created)
            if (payload.eventType === "INSERT") {
              return [payload.new, ...currentIncidents];
            }
            // Handle a DELETE
            if (payload.eventType === "DELETE") {
              return currentIncidents.filter((inc) => inc.id !== payload.old.id);
            }
            return currentIncidents;
          });
        }
      )
      .subscribe();

    // 2. Cleanup the subscription when the component unmounts
    return () => {
      supabase.removeChannel(incidentChannel);
    };
  }, [setIncidents]);
}