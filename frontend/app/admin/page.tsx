"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUser } from "@/context/UserContext";
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
import { Users, Activity, AlertTriangle, Settings, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import EditUserModal from "../components/EditUserModal";
import InviteUsersDialog from "../components/InviteUsersDialog";
import UserStatsModal from "../components/UserStatsModal"; 
import MetricsDashboard from "../components/MetricsDashboard";
import AppHeader from "../components/AppHeader";
import { AppShell } from "../components/AppShell";


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
  const { currentUser, loading: profileLoading, isAdmin } = useCurrentUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DetailedUserStat | null>(null);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }
    if (!currentUser) {
      router.push("/register");
      return;
    }
    if (!isAdmin) {
      router.push("/");
      return;
    }

    fetchStats();
  }, [user, currentUser, isAdmin, authLoading, profileLoading, router]);

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

  if (authLoading || profileLoading || (isAdmin && loading)) {
    return (
      <AppShell>
        <p className="text-slate-600 dark:text-slate-400">Loading Admin Panel...</p>
      </AppShell>
    );
  }
  if (!isAdmin) return null;
  if (!stats) {
    return (
      <AppShell>
        <p className="text-slate-600 dark:text-slate-400">Error loading stats.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Admin</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Admin Console</h1>
        </div>
        <span className="px-3 py-1 bg-cyan-50 text-cyan-800 rounded-full text-sm font-medium border border-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/20">
          Organization View
        </span>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Performance Metrics</h2>
        <MetricsDashboard />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="gap-0 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{stats.total_users}</div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Incidents</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50">{stats.active_incidents}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {stats.total_incidents} lifetime incidents
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Critical (SEV1)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">
              {stats.incidents_by_severity["SEV1"] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="border-b border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 pt-4 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Team Performance & Management</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">Click a row to view detailed individual stats.</p>
            </div>
            <Button onClick={() => setIsInviteOpen(true)} className="shrink-0">
              <UserPlus className="h-4 w-4" />
              Invite teammate
            </Button>
          </div>
        </CardHeader>
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
                className="cursor-pointer hover:bg-cyan-50/50 dark:hover:bg-cyan-500/10 transition-colors"
                onClick={() => handleRowClick(u)}
              >
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{u.email}</TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${u.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200' : 
                      u.role === 'MANAGER' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200' : 
                      'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200'}`}>
                    {u.role || "ENGINEER"} 
                  </span>
                </TableCell>
                <TableCell className="text-center">{u.assigned_count}</TableCell>
                <TableCell className="text-center text-emerald-600 dark:text-emerald-400 font-medium">{u.resolved_count}</TableCell>
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
                 <TableCell colSpan={6} className="h-24 text-center text-slate-600 dark:text-slate-400">
                    No users found in this organization.
                 </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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

      <InviteUsersDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvited={fetchStats}
      />

    </AppShell>
  );
}