import { useState, useEffect } from "react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  ArrowRightLeft, 
  CircleUser, 
  ShieldAlert 
} from "lucide-react";

type Event = {
  id: string;
  event_type: string;
  old_value: string;
  new_value: string;
  comment: string;
  created_at: string;
  actor_id: string | null;
};

type IncidentHistoryProps = {
  incidentId: string | null;
  incidentTitle: string;
  incidentSeverity: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentHistory({ incidentId, incidentTitle, incidentSeverity, isOpen, onClose }
  : IncidentHistoryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (incidentId && isOpen) {
      setLoading(true);
      fetch(`http://localhost:8000/incidents/${incidentId}/events`)
        .then(res => res.json())
        .then(data => setEvents(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [incidentId, isOpen]);

  // Helper to format date nicely
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Helper for Header Badge Styles (matches Dashboard)
  const getSevBadgeStyles = (sev: string) => {
    switch (sev) {
      case "SEV1": return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";
      case "SEV2": return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100";
      case "SEV3": return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
      default: return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto sm:p-4">
        <SheetHeader className="mb-8 border-b pb-4">
          <SheetTitle className="text-xl font-bold text-slate-900">Incident Audit Log</SheetTitle>
          <SheetDescription>
            History of state transitions and team notes.
          </SheetDescription>

          {/* Incident Header */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800 text-lg">
                {incidentTitle}
              </span>
            </div>
            <Badge className={getSevBadgeStyles(incidentSeverity)}>
              {incidentSeverity}
            </Badge>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">Loading history...</div>
        ) : (
          <div className="relative pl-6 border-slate-200 space-y-8 ml-2">
            {events.map((event) => (
              <div key={event.id} className="relative">
                {/* Timeline Dot */}
                <span className="absolute -left-6.25 top-1 h-4 w-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                  {event.event_type === "STATUS_CHANGE" ? (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                  )}
                </span>

                {/* Event Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {event.event_type === "STATUS_CHANGE" ? (
                      <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="font-semibold text-sm text-slate-800">
                      {event.event_type === "STATUS_CHANGE" ? "Status Update" : "Comment Added"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(event.created_at)}
                  </span>
                </div>

                {/* Event Content Card */}
                <div className="bg-blue-50/80 border border-slate-100 rounded-md p-3 shadow-sm">
                  {/* State Transition Visual */}
                  {event.event_type === "STATUS_CHANGE" && event.old_value && (
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <Badge variant="outline" className="text-slate-500 bg-white hover:bg-white">
                        {event.old_value}
                      </Badge>
                      <span className="text-slate-400">→</span>
                      <Badge className="bg-slate-800 hover:bg-slate-900">
                        {event.new_value}
                      </Badge>
                    </div>
                  )}

                  {/* Comment Text */}
                  {event.comment && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                          {event.comment}
                      </p>
                  )}
                    
                  {/* Actor */}
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                    <CircleUser className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                      Actor ID: {event.actor_id ? event.actor_id.slice(0,8) : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {events.length === 0 && (
              <div className="text-sm text-slate-500 italic pl-2">No history events found.</div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}