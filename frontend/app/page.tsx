"use client";

import { useEffect, useState } from "react";
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
  Clock 
} from "lucide-react";
import IncidentHistory from "./components/IncidentHistory";
import CreateIncidentModal from "./components/CreateIncidentModal";
import IncidentActionModal from "./components/IncidentActionModal";

type Incident = {
  id: string;
  title: string;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  status: string;
  owner_id: string;
  allowed_transitions: string[];
};

const CURRENT_USER_ID = "7886bc74-aed9-4fb9-a940-458598048f86";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const [actionIncident, setActionIncident] = useState<Incident | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/incidents`);
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

  // --- Visual Helpers ---
  const getSevStyles = (sev: string) => {
    switch (sev) {
      case "SEV1": return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-bold";
      case "SEV2": return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100";
      case "SEV3": return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
      default: return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DETECTED": return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "INVESTIGATING": return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "MITIGATED": return <ShieldAlert className="h-4 w-4 text-green-500" />;
      case "RESOLVED": return <CheckCircle className="h-4 w-4 text-slate-500" />;
      default: return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "INVESTIGATING": return "bg-blue-600 hover:bg-blue-700";
      case "MITIGATED": return "bg-emerald-600 hover:bg-emerald-700";
      case "RESOLVED": return "bg-green-600 hover:bg-green-700";
      case "CLOSED": return "bg-slate-600 hover:bg-slate-700";
      case "ESCALATED": return "bg-red-600 hover:bg-red-700";
      default: return "bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200";
    }
  };

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId); 
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">IncidentFlow</h1>
          <p className="text-slate-500 mt-1">Real-time system health and incident response</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={fetchIncidents} variant="outline" className="gap-2 shadow-sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </Button>
          <CreateIncidentModal onIncidentCreated={fetchIncidents} />
        </div>
      </div>
      
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">High Severity</div>
            <div className="text-3xl font-bold text-slate-900">{incidents.filter(i => i.severity === 'SEV1').length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">In Progress</div>
            <div className="text-3xl font-bold text-slate-900">{incidents.filter(i => i.status === 'INVESTIGATING').length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="pt-5">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Active</div>
            <div className="text-3xl font-bold text-slate-900">{incidents.filter(i => i.status !== 'RESOLVED').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="shadow-md border-slate-200">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-lg font-semibold text-slate-800">Incident Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-25 pl-6 uppercase text-[11px] font-bold text-slate-500">Severity</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-500">Incident Details</TableHead>
                <TableHead className="uppercase text-[11px] font-bold text-slate-500">Current Status</TableHead>
                <TableHead className="text-right pr-6 uppercase text-[11px] font-bold text-slate-500">Workflow Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id} className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedIncidentId(incident.id)}>
                  <TableCell className="pl-6">
                    <Badge variant="outline" className={getSevStyles(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="font-semibold text-slate-900 text-base">{incident.title}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{incident.id.slice(0, 8)}...</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5 font-medium text-slate-700">
                      {getStatusIcon(incident.status)}
                      <span className="text-sm">{incident.status}</span>
                    </div>
                  </TableCell>
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
                      Action
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