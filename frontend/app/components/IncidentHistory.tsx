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
import IncidentCommentThread from "./IncidentCommentThread";
import { useUserDirectory } from "@/context/UserContext";
import PostMortemViewer from "./PostMortemViewer";

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
      case "SEV1": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30";
      case "SEV2": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30";
      case "SEV3": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30";
      default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/15";
    }
  };

  const getEventStyles = (eventType: string) => {
    switch (eventType) {
      case "CREATION":
        return {
          icon: PlusCircle,
          color: "bg-emerald-500",
          label: "Incident Created",
          card: "bg-emerald-50 border-emerald-200 border-l-emerald-500 dark:bg-emerald-500/15 dark:border-emerald-400/25 dark:border-l-emerald-400",
        };
      case "STATUS_CHANGE":
        return {
          icon: ArrowRightLeft,
          color: "bg-blue-500",
          label: "Status Updated",
          card: "bg-blue-50 border-blue-200 border-l-blue-500 dark:bg-blue-500/15 dark:border-blue-400/25 dark:border-l-blue-400",
        };
      case "SEVERITY_CHANGE":
        return {
          icon: AlertTriangle,
          color: "bg-orange-500",
          label: "Severity Change",
          card: "bg-orange-50 border-orange-200 border-l-orange-500 dark:bg-orange-500/15 dark:border-orange-400/25 dark:border-l-orange-400",
        };
      case "OWNER_CHANGE":
        return {
          icon: UserCog,
          color: "bg-purple-500",
          label: "Reassigned",
          card: "bg-purple-50 border-purple-200 border-l-purple-500 dark:bg-purple-500/15 dark:border-purple-400/25 dark:border-l-purple-400",
        };
      case "SLA_BREACH":
        return {
          icon: Flame,
          color: "bg-red-600 animate-pulse",
          label: "SLA Breach",
          card: "bg-red-50 border-red-200 border-l-red-500 dark:bg-red-500/15 dark:border-red-400/30 dark:border-l-red-400",
        };
      case "ATTACHMENT_UPLOAD":
        return {
          icon: FileUp,
          color: "bg-indigo-500",
          label: "File Uploaded",
          card: "bg-indigo-50 border-indigo-200 border-l-indigo-500 dark:bg-indigo-500/15 dark:border-indigo-400/25 dark:border-l-indigo-400",
        };
      case "ATTACHMENT_DELETE":
        return {
          icon: Trash2,
          color: "bg-slate-50 border-slate-200 border-l-slate-400 dark:bg-slate-800/80 dark:border-white/15 dark:border-l-slate-400",
        };
      case "COMMENT":
      default:
        return {
          icon: MessageSquare,
          color: "bg-cyan-500",
          label: "Comment",
          card: "bg-cyan-50/80 border-cyan-200 border-l-cyan-500 dark:bg-cyan-500/10 dark:border-cyan-400/25 dark:border-l-cyan-400",
        };
    }
  };

  const createdDate = createdAt?.split(",")[0] || "Unknown";
  const orderedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl gap-0 overflow-hidden sm:p-0">
        <div className="relative shrink-0 overflow-hidden border-b-2 border-blue-400 bg-gradient-to-br from-blue-50 via-cyan-50/90 to-white px-5 py-5 pr-12 shadow-md shadow-blue-500/10 dark:border-cyan-500/50 dark:from-blue-950/70 dark:via-slate-950 dark:to-slate-950 dark:shadow-black/40">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-300/30 blur-2xl dark:bg-cyan-400/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl dark:bg-blue-500/10" />
          <SheetHeader className="relative gap-2.5 p-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-cyan-300">
              Incident details
            </p>
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-50">
                {incidentTitle}
              </SheetTitle>
              <Badge className={`${getSevBadgeStyles(incidentSeverity)} px-2 py-0.5 text-xs shadow-sm`}>
                {incidentSeverity}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold capitalize text-blue-800 ring-1 ring-blue-200 dark:bg-white/10 dark:text-cyan-100 dark:ring-cyan-500/30">
                {incidentStatus || "Unknown"}
              </span>
              <span className="rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10">
                {incidentAssignee || "Unassigned"}
              </span>
              <span className="rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10">
                {createdDate}
              </span>
              {incidentId && (
                <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono text-[12px] text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10" title={incidentId}>
                  {incidentId.slice(0, 8)}
                </span>
              )}
            </p>
            {incidentDescription && (
              <SheetDescription
                className="line-clamp-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                title={incidentDescription}
              >
                {incidentDescription}
              </SheetDescription>
            )}
          </SheetHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-slate-50/70 px-5 pt-3 dark:bg-slate-900/40">
            <Tabs defaultValue="timeline" className="flex min-h-0 flex-1 flex-col gap-2">
                <TabsList className="grid h-10 w-full shrink-0 grid-cols-2 border border-slate-300 bg-white shadow-sm shadow-blue-950/5 dark:border-white/15 dark:bg-slate-900/80">
                    <TabsTrigger
                      value="timeline"
                      className="gap-2 text-slate-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/30 dark:text-slate-300 dark:data-[state=active]:from-blue-500 dark:data-[state=active]:to-cyan-500 dark:data-[state=active]:text-white"
                    >
                        <History className="h-4 w-4" /> Audit Log
                    </TabsTrigger>
                    <TabsTrigger
                      value="attachments"
                      className="gap-2 text-slate-600 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/30 dark:text-slate-300 dark:data-[state=active]:from-blue-500 dark:data-[state=active]:to-cyan-500 dark:data-[state=active]:text-white"
                    >
                        <Paperclip className="h-4 w-4" /> Attachments
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: EXISTING TIMELINE */}
                <TabsContent value="timeline" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                  {loading ? (
                    <div className="flex justify-center py-10 text-slate-600 dark:text-slate-300">Loading history...</div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {orderedEvents.length === 0 ? (
                        <div className="text-sm text-slate-600 dark:text-slate-300 italic py-4">No history events found.</div>
                      ) : (
                    <div className="relative ml-2 max-w-[92%] space-y-4 border-l-2 border-slate-400 pb-3 pl-6 pt-1 dark:border-slate-500">
                      {orderedEvents.map((event) => {
                        const style = getEventStyles(event.event_type);
                        const Icon = style.icon;

                        return (
                          <div key={event.id} className="relative">
                            <span
                              className={`absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-2 border-slate-50 dark:border-slate-800 ${style.color}`}
                            />

                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
                                <span className={`text-sm font-semibold ${event.event_type === 'SLA_BREACH' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {style.label}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-300">
                                {formatDate(event.created_at)}
                              </span>
                            </div>

                            <div className={`rounded-lg border border-l-[3px] p-2.5 shadow-md shadow-slate-900/10 dark:shadow-black/50 ${style.card}`}>
                              
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
                                            : "text-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200"
                                        }`}
                                      >
                                        {event.event_type === "OWNER_CHANGE" ? event.old_value.slice(0, 8) : event.old_value}
                                      </Badge>
                                      <span className="text-slate-400 dark:text-slate-300">→</span>
                                    </>
                                  )}
                                  {event.new_value && (
                                    <Badge 
                                      className={`font-mono text-xs ${
                                        event.event_type === "SEVERITY_CHANGE"
                                          ? getSevBadgeStyles(event.new_value)
                                          : event.event_type === "SLA_BREACH" 
                                            ? "bg-red-600 text-white" 
                                            : "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                                      }`}
                                    >
                                      {event.event_type === "OWNER_CHANGE" ? event.new_value.slice(0, 8) : event.new_value}
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Comment Body */}
                              {event.comment && (
                                <p className="text-sm text-slate-700 leading-relaxed break-words dark:text-slate-100">
                                  {event.comment}
                                </p>
                              )}

                              {/* Footer: Actor Info */}
                              <div className="mt-2 flex items-center gap-2 pt-1.5 border-t border-slate-300 dark:border-slate-600">
                                <CircleUser className="h-3.5 w-3.5 text-slate-600 dark:text-slate-200" />
                                <span className="text-xs text-slate-600 dark:text-slate-200 tracking-wide">
                                  {userMap[event.actor_id || ""]?.full_name || "System Bot"} ({event.actor_id ? event.actor_id.slice(0, 8) : 'System Bot'})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                      )}
                    </div>
                  )}

                  {incidentId && (
                    <div className="shrink-0">
                      <div className="mx-4 my-3">
                      <IncidentCommentThread
                        incidentId={incidentId}
                        onCommentAdded={fetchEvents}
                      />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attachments" className="mt-0 min-h-0 flex-1 overflow-y-auto py-2 pb-4">
                    {incidentId && <AttachmentManager incidentId={incidentId} onAttachmentChange={fetchEvents} />}
                </TabsContent>
            </Tabs>
        </div>

        {incidentId && (
          <div className="shrink-0 px-4 pb-3 empty:hidden">
            <PostMortemViewer 
              incidentId={incidentId} 
              status={incidentStatus ?? ""} 
            />
          </div>
        )}
                
      </SheetContent>
    </Sheet>
  );
}