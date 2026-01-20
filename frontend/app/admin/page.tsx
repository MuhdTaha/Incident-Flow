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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Activity, AlertTriangle, ShieldAlert, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import EditUserModal from "../components/EditUserModal";
import { Button } from "@/components/ui/button";

type UserStat = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  incident_count: number;
};

type DashboardStats = {
  total_users: number;
  total_incidents: number;
  active_incidents: number;
  incidents_by_severity: Record<string, number>;
  users: UserStat[];
};

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStat | null>(null);

  // Protect the route
  useEffect(() => {
    if (!authLoading) {
      if (!user || user?.app_metadata.role !== "ADMIN") {
        console.log("Redirecting non-admin user");
        router.push("/"); // Kick non-admins out
      } else {
        fetchStats();
      }
    }
  }, [user, authLoading, router]);

  const fetchStats = async () => {
    try {
      const res = await authFetch("/admin/stats");
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

  const handleEditClick = (user: UserStat) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  if (loading || authLoading) return <div className="p-8">Loading Admin Panel...</div>;
  if (!stats) return <div className="p-8">Error loading stats.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Console</h1>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          Organization View
        </span>
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
      <div className="rounded-md border bg-white shadow">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-800">User Management</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Employee Name</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">Joined</TableHead>
              <TableHead className="text-center">Incidents Assigned</TableHead>
              <TableHead className="text-center">Role</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-center">{u.full_name}</TableCell>
                <TableCell className="text-slate-500 text-center">{u.email}</TableCell>
                <TableCell className="text-center">
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-center">{u.incident_count}</TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-center rounded-full text-xs font-medium
                    ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 
                      u.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' : 
                      'bg-slate-100 text-slate-800'}`}>
                    {u.role}
                  </span>
                </TableCell>
                <TableCell className="text-center items-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditClick(u)}
                    className="hover:bg-slate-100"
                    disabled={u.id === user?.id} // Cannot edit yourself
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Render the Modal */}
      <EditUserModal 
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchStats} // Refresh data after edit/delete
      />
    </div>
  );
}