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
  PlusCircle,
  History,
  Paperclip,
  AlertTriangle,
  FileUp,
  Flame,
  Trash2,
  UserCog
} from "lucide-react";

import { authFetch } from "@/lib/api";
import AttachmentManager from "./AttachmentManager";
import { useUserDirectory } from "@/context/UserContext";

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
  incidentStatus?: string | null;
  incidentAssignee?: string | null;
  createdAt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentHistory({ incidentId, incidentTitle, incidentDescription, incidentSeverity, incidentStatus, incidentAssignee, createdAt, isOpen, onClose }
  : IncidentHistoryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const {userMap} = useUserDirectory();

  const fetchEvents = async () => {
    if (!incidentId) return;
    
    setLoading(true);
    try {
      const res = await authFetch(`/incidents/${incidentId}/events`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!incidentId || !isOpen) return;
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getEventStyles = (eventType: string) => {
    switch (eventType) {
      case "CREATION": return { icon: PlusCircle, color: "bg-emerald-500", label: "Incident Created" };
      case "STATUS_CHANGE": return { icon: ArrowRightLeft, color: "bg-blue-500", label: "Status Updated" };
      case "SEVERITY_CHANGE":
        return { icon: AlertTriangle, color: "bg-orange-500", label: "Severity Change" };
      case "OWNER_CHANGE":
        return { icon: UserCog, color: "bg-purple-500", label: "Reassigned" };
      case "SLA_BREACH":
        return { icon: Flame, color: "bg-red-600 animate-pulse", label: "SLA Breach" };
      case "ATTACHMENT_UPLOAD":
        return { icon: FileUp, color: "bg-indigo-500", label: "File Uploaded" };
      case "ATTACHMENT_DELETE":
        return { icon: Trash2, color: "bg-slate-500", label: "File Deleted" };
      case "COMMENT":
      default:
        return { icon: MessageSquare, color: "bg-slate-400", label: "Comment" };
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto sm:p-0">
        
        {/* Header */}
        <div className="p-6 bg-white sticky top-0 z-10 border-b">
            <SheetHeader className="pb-0">
            <SheetTitle className="text-xl font-bold text-slate-900">Incident Details</SheetTitle>

            <div className="mt-4 space-y-3">
                {/* Title and Severity */}
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900 text-lg leading-tight">
                        {incidentTitle}
                    </h3>
                    <Badge className={getSevBadgeStyles(incidentSeverity)}>
                        {incidentSeverity}
                    </Badge>
                </div>

                {/* Metadata */}
                <div>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">ID</p>
                    <p className="font-mono text-slate-700 text-xs break-all">{incidentId}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Status</p>
                        <p className="text-slate-700 font-medium capitalize">{incidentStatus || "Unknown"}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Assignee</p>
                        <p className={incidentAssignee ? "text-slate-700 font-medium" : "italic text-slate-400"}>
                            {incidentAssignee || "Unassigned"}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Created At</p>
                        <p className="text-slate-700 font-medium">{createdAt?.split(',')[0] || "Unknown"}</p>
                    </div>
                </div>

                {/* Description */}
                {incidentDescription && (
                    <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                        {incidentDescription}
                    </p>
                )}
            </div>
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
                    <div className="relative pl-6 border-l-2 border-slate-100 space-y-8 ml-2 pb-10">
                      {events.map((event) => {
                        const style = getEventStyles(event.event_type);
                        const Icon = style.icon;

                        return (
                          <div key={event.id} className="relative group">
                            {/* Timeline Dot */}
                            <span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-slate-100 flex items-center justify-center ${style.color}`} />

                            {/* Header Row */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-slate-500" />
                                <span className={`font-semibold text-sm ${event.event_type === 'SLA_BREACH' ? 'text-red-600' : 'text-slate-800'}`}>
                                  {style.label}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 font-mono">
                                {formatDate(event.created_at)}
                              </span>
                            </div>

                            {/* Content Card */}
                            <div className={`bg-slate-50/50 border border-slate-100 rounded-md p-3 shadow-sm transition-all hover:shadow-md hover:border-slate-200 ${event.event_type === 'SLA_BREACH' ? 'bg-red-50/50 border-red-100' : ''}`}>
                              
                              {/* Value Changes (Old -> New) */}
                              {(event.old_value || event.new_value) && (
                                <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                                  {event.old_value && (
                                    <>
                                      <Badge 
                                        variant="outline" 
                                        className={`font-mono text-xs ${
                                          event.event_type === "SEVERITY_CHANGE" 
                                            ? getSevBadgeStyles(event.old_value)
                                            : "text-slate-500 bg-white"
                                        }`}
                                      >
                                        {event.event_type === "OWNER_CHANGE" ? event.old_value.slice(0, 8) : event.old_value}
                                      </Badge>
                                      <span className="text-slate-400">→</span>
                                    </>
                                  )}
                                  {event.new_value && (
                                    <Badge 
                                      className={`font-mono text-xs ${
                                        event.event_type === "SEVERITY_CHANGE"
                                          ? getSevBadgeStyles(event.new_value)
                                          : event.event_type === "SLA_BREACH" 
                                            ? "bg-red-600" 
                                            : "bg-slate-800"
                                      }`}
                                    >
                                      {event.event_type === "OWNER_CHANGE" ? event.new_value.slice(0, 8) : event.new_value}
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Comment Body */}
                              {event.comment && (
                                <p className="text-sm text-slate-600 leading-relaxed break-words">
                                  {event.comment}
                                </p>
                              )}

                              {/* Footer: Actor Info */}
                              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                                <CircleUser className="h-3 w-3 text-slate-400" />
                                <span className="text-[10px] text-slate-400 tracking-wide">
                                  {userMap[event.actor_id || ""]?.full_name || "System Bot"} ({event.actor_id ? event.actor_id.slice(0, 8) : 'System Bot'})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {events.length === 0 && (
                        <div className="text-sm text-slate-500 italic py-4">No history events found.</div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 2: ATTACHMENTS MANAGER */}
                <TabsContent value="attachments">
                    {incidentId && <AttachmentManager incidentId={incidentId} onAttachmentChange={fetchEvents} />}
                </TabsContent>
            </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}