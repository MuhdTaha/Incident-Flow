import { useState, useEffect } from "react";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from "@/components/ui/sheet";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  ArrowRightLeft, 
  CircleUser, 
  ShieldAlert,
  History,
  Paperclip
} from "lucide-react";

// Import the new component
import AttachmentManager from "./AttachmentManager";

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
  incidentDescription: string;
  incidentSeverity: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentHistory({ incidentId, incidentTitle, incidentDescription, incidentSeverity, isOpen, onClose }
  : IncidentHistoryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (incidentId && isOpen) {
      setLoading(true);
      // Ideally use authFetch here to be safe, but fetch works for now
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/incidents/${incidentId}/events`)
        .then(res => res.json())
        .then(data => setEvents(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [incidentId, isOpen]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getSevBadgeStyles = (sev: string) => {
    switch (sev) {
      case "SEV1": return "bg-red-100 text-red-700 border-red-200";
      case "SEV2": return "bg-orange-100 text-orange-700 border-orange-200";
      case "SEV3": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto sm:p-0">
        
        {/* Header */}
        <div className="p-6 bg-white sticky top-0 z-10 border-b">
            <SheetHeader className="mb-0">
            <SheetTitle className="text-xl font-bold text-slate-900">Incident Details</SheetTitle>
            <SheetDescription>
                Manage incident context and files.
            </SheetDescription>

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
            <p className="text-sm text-slate-600">
                {incidentDescription || <span className="italic text-slate-400">No description provided.</span>}
            </p>
            </SheetHeader>
        </div>

        {/* Tabs Section */}
        <div className="p-6 pt-2">
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="timeline" className="gap-2">
                        <History className="h-4 w-4" /> Audit Log
                    </TabsTrigger>
                    <TabsTrigger value="attachments" className="gap-2">
                        <Paperclip className="h-4 w-4" /> Attachments
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: EXISTING TIMELINE */}
                <TabsContent value="timeline">
                    {loading ? (
                    <div className="flex justify-center py-10 text-slate-400">Loading history...</div>
                    ) : (
                    <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-2">
                        {events.map((event) => (
                        <div key={event.id} className="relative">
                            <span className="absolute -left-7.75 top-1 h-4 w-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                            {event.event_type === "STATUS_CHANGE" ? (
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                            ) : (
                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                            )}
                            </span>

                            <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {event.event_type === "STATUS_CHANGE" ? (
                                <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                                ) : (
                                <MessageSquare className="h-4 w-4 text-slate-500" />
                                )}
                                <span className="font-semibold text-sm text-slate-800">
                                {event.event_type === "STATUS_CHANGE" ? "Status Update" : 
                                 event.event_type === "SLA_BREACH" ? "SLA Breach" : "Comment"}
                                </span>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                                {formatDate(event.created_at)}
                            </span>
                            </div>

                            <div className="bg-slate-50/50 border border-slate-100 rounded-md p-3 shadow-sm">
                            {event.event_type === "STATUS_CHANGE" && event.old_value && (
                                <div className="flex items-center gap-2 mb-2 text-sm">
                                <Badge variant="outline" className="text-slate-500 bg-white">
                                    {event.old_value}
                                </Badge>
                                <span className="text-slate-400">→</span>
                                <Badge className="bg-slate-800 hover:bg-slate-900">
                                    {event.new_value}
                                </Badge>
                                </div>
                            )}

                            {event.comment && (
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {event.comment}
                                </p>
                            )}
                                
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                                <CircleUser className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                                Actor: {event.actor_id ? event.actor_id.slice(0,8) : 'System'}
                                </span>
                            </div>
                            </div>
                        </div>
                        ))}
                        
                        {events.length === 0 && (
                        <div className="text-sm text-slate-500 italic">No history events found.</div>
                        )}
                    </div>
                    )}
                </TabsContent>

                {/* TAB 2: ATTACHMENTS MANAGER */}
                <TabsContent value="attachments">
                    {incidentId && <AttachmentManager incidentId={incidentId} />}
                </TabsContent>
            </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}