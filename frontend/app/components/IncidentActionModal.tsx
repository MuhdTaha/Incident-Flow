import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft, MessageSquare, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api";

type Incident = {
  id: string;
  title: string;
  status: string;
  allowed_transitions: string[];
  owner_id: string;
};

type User = {
  id: string;
  full_name: string;
};

type IncidentActionModalProps = {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function IncidentActionModal({ incident, isOpen, onClose, onSuccess }: IncidentActionModalProps) {
  const { user } = useAuth();

  // State
  const [actionType, setActionType] = useState<"TRANSITION" | "COMMENT" | "EDIT">("TRANSITION");
  const [selectedState, setSelectedState] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Edit Mode States
  const [severity, setSeverity] = useState<"SEV1" | "SEV2" | "SEV3" | "SEV4">("SEV4");
  const [ownerId, setOwnerId] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);

  // Permissions
  const isManagerOrAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";

  // Fetch Users when modal opens (for reassignment)
  useEffect(() => {
    if (isOpen) {
      authFetch("/users")
        .then((res) => res.json())
        .then((data) => setUsers(data))
        .catch((err) => console.error("Failed to fetch users", err));
    }
  }, [isOpen]);

  // Reset/Initialize state when incident changes
  useEffect(() => {
    if (incident) {
      // Default to first allowed transition
      if (incident.allowed_transitions.length > 0) {
        setActionType("TRANSITION");
        setSelectedState(incident.allowed_transitions[0]);
      } else {
        setActionType("COMMENT");
        setSelectedState("");
      }
      setComment("");
    }
  }, [incident, isOpen]);

  const handleSubmit = async () => {
    if (!incident || !user) return;
    setLoading(true);

    try {
      // Handle State Transition
      if (actionType === "TRANSITION") {
        const res = await authFetch(`/incidents/${incident.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_state: selectedState,
            actor_id: user.id,
            comment: comment || "State updated via Action Modal",
          }),
        });

        if (!res.ok) throw new Error("Failed to transition incident");
      } else if (actionType === "COMMENT" && comment) {
        // Handle Comment Addition
        const res = await authFetch(`/incidents/${incident.id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({
            actor_id: user.id,
            comment: comment,
          }),
        });
        if (!res.ok) throw new Error("Failed to add comment");
      } else if (actionType === "EDIT") {
        // Handle Incident Edit (e.g., Severity or Assignee Change)
        const res = await authFetch(`/incidents/${incident.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({
            severity: severity,
            owner_id: ownerId,
            comment: comment || "Incident edited via Action Modal",
          }),
        });

        if (res.status === 403) {
          alert("Permission Denied: You cannot edit this incident.");
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error("Failed to update incident");
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!incident || !user || !isAdmin) return;
    if (!confirm("Are you sure you want to delete this incident? This action cannot be undone.")) return;

    setLoading(true);
    try {
      const res = await authFetch(`/incidents/${incident.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: user.id }),
      });
      if (!res.ok) throw new Error("Failed to delete incident");
      onSuccess();
      onClose();
      alert("Incident deleted successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete incident. Please try again.");
      setLoading(false);
    }
  }

  const getActionColor = (action: string) => {
    if (actionType === "TRANSITION") {
      switch (action) {
        case "INVESTIGATING": return "bg-blue-600 hover:bg-blue-700";
        case "MITIGATED": return "bg-emerald-600 hover:bg-emerald-700";
        case "RESOLVED": return "bg-green-600 hover:bg-green-700";
        case "CLOSED": return "bg-slate-600 hover:bg-slate-700";
        case "ESCALATED": return "bg-red-600 hover:bg-red-700";
        default: return "";
      }
    } 
    if (actionType === "EDIT") {
      return "bg-purple-600 hover:bg-purple-700";
    }
    return "";
  };

  if (!incident || !user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Incident</DialogTitle>
          <p className="text-sm text-slate-500">
            {incident.title} <span className="font-mono text-xs">({incident.id.slice(0, 8)})</span>
          </p>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Action Selector */}
          <div className="grid gap-2">
            <Label>Action</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={actionType === "TRANSITION" ? "default" : "outline"}
                className="flex-1 justify-start gap-2"
                onClick={() => setActionType("TRANSITION")}
                disabled={incident.allowed_transitions.length === 0}
              >
                <ArrowRightLeft className="h-4 w-4" /> Status
              </Button>
              
              <Button
                variant={actionType === "COMMENT" ? "default" : "outline"}
                className="flex-1 justify-start gap-2"
                onClick={() => setActionType("COMMENT")}
              >
                <MessageSquare className="h-4 w-4" /> Comment
              </Button>

              <Button
                variant={actionType === "EDIT" ? "default" : "outline"}
                className="flex-1 justify-start gap-2"
                onClick={() => setActionType("EDIT")}
                disabled={!isManagerOrAdmin}
                title={!isManagerOrAdmin ? "Only Managers can edit incident details" : ""}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </div>
          </div>

          {/* TRANSITION VIEW */}
          {actionType === "TRANSITION" && (
            <div className="grid gap-2">
              <Label>New Status</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status..." />
                </SelectTrigger>
                <SelectContent>
                  {incident.allowed_transitions.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state.charAt(0) + state.slice(1).toLowerCase().replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* EDIT VIEW */}
          {actionType === "EDIT" && (
            <div className="grid gap-4 p-4 border rounded-md bg-slate-50">
              <div className="grid gap-2">
                <Label>Severity Level</Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEV1">SEV1 (Critical)</SelectItem>
                    <SelectItem value="SEV2">SEV2 (High)</SelectItem>
                    <SelectItem value="SEV3">SEV3 (Moderate)</SelectItem>
                    <SelectItem value="SEV4">SEV4 (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delete Zone (Admin Only) */}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2"
                    onClick={handleDelete}
                    type="button" 
                  >
                    <Trash2 className="h-4 w-4" /> Delete Incident (Admin)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Comment Box */}
          <div className="grid gap-2">
            <Label>Reasoning / Context {actionType !== "TRANSITION" && "(Optional)"}</Label>
            <Textarea
              placeholder={actionType === "EDIT" ? "Why are these details changing?" : "Context for this action..."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-24 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (actionType === "TRANSITION" && !selectedState)}
            className={getActionColor(selectedState)}
          >
            {loading ? "Updating..." : "Confirm Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}