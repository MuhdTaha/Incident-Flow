"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Activity, AlertTriangle, ShieldAlert, Settings, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import EditUserModal from "../components/EditUserModal";
import UserStatsModal from "../components/UserStatsModal"; 
import MetricsDashboard from "../components/MetricsDashboard";
import AppHeader from "../components/AppHeader";


export type DetailedUserStat = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  assigned_count: number;
  resolved_count: number;
  comments_made: number;
  escalations_triggered: number;
};

type DashboardStats = {
  total_users: number;
  total_incidents: number;
  active_incidents: number;
  incidents_by_severity: Record<string, number>;
  user_performance: DetailedUserStat[]; // Updated field name
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DetailedUserStat | null>(null);

  // Protect the route
  useEffect(() => {
    if (!authLoading) {
      if (!user || user?.app_metadata.role !== "ADMIN") {
        console.log("Redirecting non-admin user");
        router.push("/");
      } else {
        fetchStats();
      }
    }
  }, [user, authLoading, router]);

  const fetchStats = async () => {
    try {
      const res = await authFetch("/admin/stats"); // Assuming this is your endpoint
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, u: DetailedUserStat) => {
    e.stopPropagation(); // Prevent row click from firing
    setSelectedUser(u);
    setIsEditModalOpen(true);
  };

  const handleRowClick = (u: DetailedUserStat) => {
    setSelectedUser(u);
    setIsStatsModalOpen(true);
  };

  if (loading || authLoading) return <div className="p-8">Loading Admin Panel...</div>;
  if (!stats) return <div className="p-8">Error loading stats.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <AppHeader />

      {/* Title Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Console</h1>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          Organization View
        </span>
      </div>

      {/* Analytics Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Performance Metrics</h2>
        <MetricsDashboard />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_incidents}</div>
            <p className="text-xs text-slate-500">
              {stats.total_incidents} lifetime incidents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical (SEV1)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.incidents_by_severity["SEV1"] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <ShieldAlert className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-slate-500">Operational</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management Table */}
      <div className="rounded-md border bg-white shadow overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-800">Team Performance & Management</h3>
          <p className="text-sm text-slate-500">Click a row to view detailed individual stats.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Role</TableHead>
              <TableHead className="text-center">Assigned</TableHead>
              <TableHead className="text-center">Resolved</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.user_performance.map((u) => (
              <TableRow 
                key={u.id} 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => handleRowClick(u)}
              >
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-slate-500">{u.email}</TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 
                      u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' : 
                      'bg-slate-100 text-slate-800'}`}>
                    {u.role || "ENGINEER"} 
                  </span>
                </TableCell>
                <TableCell className="text-center">{u.assigned_count}</TableCell>
                <TableCell className="text-center text-emerald-600 font-medium">{u.resolved_count}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => handleEditClick(e, u)}
                      disabled={u.id === user?.id}
                    >
                      <Settings className="h-4 w-4 text-slate-500" />
                      <span className="sr-only">Edit Settings</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {stats.user_performance.length === 0 && (
              <TableRow>
                 <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    No users found in this organization.
                 </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Settings Modal */}
      {/* Ensure your EditUserModal is updated to accept DetailedUserStat if it needs those properties */}
      <EditUserModal 
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchStats} 
      />

      {/* New Detailed Stats Modal */}
      <UserStatsModal
        user={selectedUser}
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />

    </div>
  );
}