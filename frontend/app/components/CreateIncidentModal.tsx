import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUserDirectory } from "@/context/UserContext";

type User = {
  id: string;
  full_name: string;
}

export default function CreateIncidentModal({ onIncidentCreated }: { onIncidentCreated: () => void }) {
  const { user: currentUser } = useAuth();
  const { users } = useUserDirectory(); // Get global user data
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState<"SEV1" | "SEV2" | "SEV3" | "SEV4">("SEV4");
  const [assigneeId, setAssigneeId] = useState<string>("");

  // Set default assignee to current user when the modal opens
  useEffect(() => {
    if (open && currentUser && !assigneeId) {
      setAssigneeId(currentUser.id);
    }
  }, [open, currentUser, assigneeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        title,
        description: desc,
        severity,
      };
      if (assigneeId && assigneeId !== currentUser?.id) payload.owner_id = assigneeId;

      const res = await authFetch("/incidents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    
      if (res.ok) {
        setOpen(false);
        onIncidentCreated();

        // Reset Form
        setTitle("");
        setDesc("");
        setSeverity("SEV4");
        setAssigneeId(currentUser?.id || "");
      } else {
        const err = await res.json();
        alert("Failed to create incident: " + err.message);
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Declare Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Declare New Incident
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title" className="font-semibold">Incident Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Database High CPU Usage"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="severity" className="font-semibold">Severity Level</Label>
              <select
                id="severity"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-950"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "SEV1" | "SEV2" | "SEV3" | "SEV4")}
              >
                <option value="SEV1">SEV1 (Critical)</option>
                <option value="SEV2">SEV2 (High)</option>
                <option value="SEV3">SEV3 (Moderate)</option>
                <option value="SEV4">SEV4 (Low)</option>
              </select>
            </div>

            <div className="grid gap-2">
              {/* Assignee Selector */}
              <Label htmlFor="assignee" className="font-semibold">Assignee</Label>
              <select
                id="assignee"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-950"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc" className="font-semibold">Description</Label>
            <Textarea
              id="desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe impact and observed symptoms..."
              className="h-24"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Creating..." : "Declare Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}