"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  RefreshCw, 
  Settings2, 
  User,
} from "lucide-react";
import IncidentHistory from "./components/IncidentHistory";
import CreateIncidentModal from "./components/CreateIncidentModal";
import IncidentActionModal from "./components/IncidentActionModal";
import AppHeader from "./components/AppHeader";
import { AppShell } from "./components/AppShell";
import IncidentStats from "./components/IncidentStats";
import { IncidentFilters, FilterState } from "./components/IncidentFilters";
import { getSevStyles, getStatusIcon } from "@/lib/incident-utils";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUser, useUserDirectory } from "@/context/UserContext";
import { authFetch } from "@/lib/api";
import { useIncidentPoll } from "@/hooks/useIncidentPoll";
import InviteUsersDialog from "./components/InviteUsersDialog";
import { consumeOpenInviteFlag } from "@/lib/auth-redirect";

type Incident = {
  id: string;
  title: string;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  status: string;
  description: string;
  owner_id: string;
  allowed_transitions: string[];
  created_at: string;
  updated_at: string;
};

export default function IncidentDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { userMap, refreshUsers } = useUserDirectory();
  const { isAdmin, loading: profileLoading, currentUser } = useCurrentUser();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const [actionIncident, setActionIncident] = useState<Incident | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    severities: [],
    statuses: [],
    assigneeId: null,
    search: ""
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (profileLoading || !currentUser?.can_create_org) return;
    router.replace("/register");
  }, [profileLoading, currentUser, router]);

  useEffect(() => {
    if (profileLoading || !currentUser) return;
    if (!consumeOpenInviteFlag()) return;
    if (isAdmin) setInviteOpen(true);
    if (window.location.search.includes("invite=")) {
      router.replace("/");
    }
  }, [profileLoading, currentUser, isAdmin, router]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/incidents");

      if (res.status === 401) {
        console.warn("User not registered in backend. Redirecting to registration page.");
        router.push("/register");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (e) {
      console.error("Failed to fetch incidents");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const { lastUpdated, refresh } = useIncidentPoll(fetchIncidents, Boolean(user?.id));

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);
  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      // 1. Search Match
      const searchMatch = !filters.search || 
        incident.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        incident.id.toLowerCase().includes(filters.search.toLowerCase());

      // 2. Severity Match
      const sevMatch = filters.severities.length === 0 || 
        filters.severities.includes(incident.severity);

      // 3. Status Match
      const statusMatch = filters.statuses.length === 0 || 
        filters.statuses.includes(incident.status);

      // 4. Assignee Match
      const assigneeMatch = !filters.assigneeId || 
        incident.owner_id === filters.assigneeId;

      return searchMatch && sevMatch && statusMatch && assigneeMatch;
    })
    // Add sorting by updated_at descending
    .sort((a, b) => {
      // Convert to Date objects for comparison, replace space with 'T' for proper ISO format
      const dateA = new Date(a.updated_at?.replace(" ", "T")).getTime();
      const dateB = new Date(b.updated_at?.replace(" ", "T")).getTime();
      return (dateB || 0) - (dateA || 0);
    });
  }, [incidents, filters]);

  return (
    <AppShell>
      <div className="print:hidden">
        <AppHeader />
      </div>
      
      {/* Summary Stat Cards */}
      <IncidentStats incidents={incidents} />

      <Card className="relative z-30 gap-0 overflow-visible py-3">
        <CardContent className="space-y-3 px-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <IncidentFilters filters={filters} setFilters={setFilters} />
          
          <div className="flex items-center gap-2 border-t md:border-t-0 border-blue-100/70 dark:border-white/10 pt-3 md:pt-0">
             {lastUpdated && (
               <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                 Last updated {lastUpdated.toLocaleTimeString()}
               </span>
             )}
             <Button onClick={refresh} variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
             </Button>
             <CreateIncidentModal onIncidentCreated={refresh} />
          </div>
        </div>
        </CardContent>
      </Card>

      <Card className="relative z-0 gap-0 py-0 overflow-hidden">
        <CardHeader className="border-b border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 pt-4 pb-3">
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Incident Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white/40 dark:bg-transparent">
          <Table>
            <TableHeader className="bg-blue-50/50 dark:bg-blue-500/10">
              <TableRow>
                <TableHead className="w-25 pl-4 uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">Severity</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">Incident Details</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">Assignee</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">Current Status</TableHead>
                <TableHead className="text-right pr-4 uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">Workflow Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredIncidents.map((incident) => (
                <TableRow key={incident.id} className="hover:bg-cyan-50/50 dark:hover:bg-cyan-500/10 transition-colors cursor-pointer" onClick={() => setSelectedIncidentId(incident.id)}>
                  {/* Severity Cell */}
                  <TableCell className="pl-4">
                    <Badge variant="outline" className={getSevStyles(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </TableCell>

                  {/* Incident Details Cell */}
                  <TableCell className="py-2.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-50 text-sm">{incident.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{incident.id.slice(0, 8)}...</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{new Date(incident.updated_at).toLocaleString()}</div>
                  </TableCell>

                  {/* Assignee Cell */}
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-200">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-sm">{userMap[incident.owner_id]?.full_name || "Unassigned"}</span>
                    </div>
                  </TableCell>

                  {/* Current Status Cell */}
                  <TableCell>
                    <div className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-200">
                      {getStatusIcon(incident.status)}
                      <span className="text-sm">{incident.status}</span>
                    </div>
                  </TableCell>

                  {/* Action Button Cell */}
                  <TableCell className="text-right pr-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-slate-700 dark:text-slate-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionIncident(incident);
                        setIsActionModalOpen(true);
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* History Slide-over */}
      <IncidentHistory 
        incidentId={selectedIncidentId} 
        incidentTitle={selectedIncident?.title || ""}
        incidentDescription={selectedIncident?.description || ""}
        incidentSeverity={selectedIncident?.severity || ""}
        incidentStatus={selectedIncident?.status || ""}
        incidentAssignee={userMap[selectedIncident?.owner_id || ""]?.full_name || null}
        createdAt={selectedIncident ? new Date(selectedIncident.created_at).toLocaleString() : ""}
        isOpen={!!selectedIncidentId} 
        onClose={() => setSelectedIncidentId(null)} 
      />

      {/* Incident Action Modal */}
      <IncidentActionModal 
        incident={actionIncident}
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onSuccess={() => {
          void refresh();
          setSelectedIncidentId(actionIncident ? actionIncident.id : null);
        }}
      />

      <InviteUsersDialog
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refreshUsers}
      />
    </AppShell>
  );
}