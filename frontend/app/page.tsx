"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
  AlertCircle, 
  CheckCircle, 
  Activity, 
  ArrowRight, 
  RefreshCw, 
  ShieldAlert,
  Settings2, 
  Clock,
  User,
  LogOut,
  Settings,
  Search,
  Filter,
  Building2,
} from "lucide-react";
import IncidentHistory from "./components/IncidentHistory";
import CreateIncidentModal from "./components/CreateIncidentModal";
import IncidentActionModal from "./components/IncidentActionModal";
import AppHeader from "./components/AppHeader";
import IncidentStats from "./components/IncidentStats";
import { IncidentFilters, FilterState } from "./components/IncidentFilters";
import { getSevStyles, getStatusIcon } from "@/lib/incident-utils";
import { useAuth } from "@/context/AuthContext";
import { useUserDirectory } from "@/context/UserContext";
import { authFetch } from "@/lib/api";

type Incident = {
  id: string;
  title: string;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  status: string;
  description: string;
  owner_id: string;
  allowed_transitions: string[];
  updated_at: string;
};

export default function IncidentDashboard() {
  const { user } = useAuth();
  const { users, userMap } = useUserDirectory();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [actionIncident, setActionIncident] = useState<Incident | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    severities: [],
    statuses: [],
    assigneeId: null,
    search: ""
  });

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/incidents");
      const data = await res.json();
      setIncidents(data);
    } catch (e) {
      console.error("Failed to fetch incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

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
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <AppHeader />
      
      {/* Summary Stat Cards */}
      <IncidentStats incidents={incidents} />

      {/* 3. New Action & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <IncidentFilters filters={filters} setFilters={setFilters} />
          
          <div className="flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
             <Button onClick={fetchIncidents} variant="ghost" size="sm" className="text-slate-500">
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
             </Button>
             <CreateIncidentModal onIncidentCreated={fetchIncidents} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="shadow-md border-slate-200 gap-0 py-0 overflow-hidden">
        <CardHeader className="border-b bg-white pt-6">
          <CardTitle className="text-lg font-semibold text-slate-800">Incident Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            {/* Table Header */}
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-25 pl-6 uppercase text-[11px] font-bold text-slate-500">Severity</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-500">Incident Details</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-500">Assignee</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-500">Current Status</TableHead>
                <TableHead className="text-right pr-6 uppercase text-[11px] font-bold text-slate-500">Workflow Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredIncidents.map((incident) => (
                <TableRow key={incident.id} className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedIncidentId(incident.id)}>
                  {/* Severity Cell */}
                  <TableCell className="pl-6">
                    <Badge variant="outline" className={getSevStyles(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </TableCell>

                  {/* Incident Details Cell */}
                  <TableCell className="py-4">
                    <div className="font-semibold text-slate-900 text-base">{incident.title}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{incident.id.slice(0, 8)}...</div>
                    <div className="text-xs text-slate-600 mt-1">{new Date(incident.updated_at).toLocaleString()}</div>
                  </TableCell>

                  {/* Assignee Cell */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2.5 font-medium text-slate-700">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-sm">{userMap[incident.owner_id]?.full_name || "Unassigned"}</span>
                    </div>
                  </TableCell>

                  {/* Current Status Cell */}
                  <TableCell>
                    <div className="flex items-center gap-2.5 font-medium text-slate-700">
                      {getStatusIcon(incident.status)}
                      <span className="text-sm">{incident.status}</span>
                    </div>
                  </TableCell>

                  {/* Action Button Cell */}
                  <TableCell className="text-right pr-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-slate-600"
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
        isOpen={!!selectedIncidentId} 
        onClose={() => setSelectedIncidentId(null)} 
      />

      {/* Incident Action Modal */}
      <IncidentActionModal 
        incident={actionIncident}
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onSuccess={() => {
          fetchIncidents();
          setSelectedIncidentId(actionIncident ? actionIncident.id : null);
        }}
      />
    </div>
  );
}