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

type User = {
  id: string;
  full_name: string;
}

export default function CreateIncidentModal({ onIncidentCreated }: { onIncidentCreated: () => void }) {
  // Props
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState<"SEV1" | "SEV2" | "SEV3" | "SEV4">("SEV4");
  const [ownerId, setOwnerId] = useState<string>("");

  // Fetch users for owner selection
  useEffect(() => {
    if (open) {
      fetch("http://localhost:8000/users")
        .then((res) => res.json())
        .then((data) => {
          setUsers(data);
          if (data.length > 0) setOwnerId(data[0].id); // Default to first user
        })
        .catch(() => console.error("Failed to fetch users"));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: desc,
          severity,
          owner_id: ownerId,
        }),
      });
    
      if (res.ok) {
        setOpen(false);
        onIncidentCreated();

        // Reset Form
        setTitle("");
        setDesc("");
        setSeverity("SEV4");
        setOwnerId(users.length > 0 ? users[0].id : "");
      } else {
        console.error("Failed to create incident");
        alert("Failed to create incident");
      }
    } catch (e) {
      console.error("Network error");
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
              <Label htmlFor="owner" className="font-semibold">Assignee</Label>
              <select
                id="owner"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-950"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
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