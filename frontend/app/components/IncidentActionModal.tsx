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
import { ArrowRightLeft, MessageSquare } from "lucide-react";

type Incident = {
  id: string;
  title: string;
  status: string;
  allowed_transitions: string[];
};

type IncidentActionModalProps = {
  incident: Incident | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

// Mock User ID (Replace with Auth later)
const CURRENT_USER_ID = "7886bc74-aed9-4fb9-a940-458598048f86";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function IncidentActionModal({ incident, isOpen, onClose, onSuccess }: IncidentActionModalProps) {
  const [actionType, setActionType] = useState<"TRANSITION" | "COMMENT">("TRANSITION");
  const [selectedState, setSelectedState] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Reset state when modal opens/changes incident
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
    if (!incident) return;
    setLoading(true);

    try {
      // Handle State Transition
      if (actionType === "TRANSITION") {
        const res = await fetch(`${API_URL}/incidents/${incident.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_state: selectedState,
            actor_id: CURRENT_USER_ID,
            comment: comment || "State updated via Action Modal",
          }),
        });

        if (!res.ok) throw new Error("Failed to transition incident");
      } else if (actionType === "COMMENT" && comment) {
        // Handle Comment Addition
        const res = await fetch(`${API_URL}/incidents/${incident.id}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({
            actor_id: CURRENT_USER_ID,
            comment: comment,
          }),
        });
        if (!res.ok) throw new Error("Failed to add comment");
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

  const getActionColor = (action: string) => {
    switch (action) {
      case "INVESTIGATING": return "bg-blue-600 hover:bg-blue-700";
      case "MITIGATED": return "bg-emerald-600 hover:bg-emerald-700";
      case "RESOLVED": return "bg-green-600 hover:bg-green-700";
      case "CLOSED": return "bg-slate-600 hover:bg-slate-700";
      case "ESCALATED": return "bg-red-600 hover:bg-red-700";
      default: return "";
    }
  };

  if (!incident) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Incident</DialogTitle>
          <p className="text-sm text-slate-500">
            {incident.title} <span className="font-mono text-xs">({incident.id.slice(0, 8)})</span>
          </p>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Action Selector */}
          <div className="grid gap-2">
            <Label>Action</Label>
            <div className="flex gap-2 flex-wrap">
              {/* Transition Button */}
              <Button
                variant={actionType === "TRANSITION" ? "default" : "outline"}
                className="flex-1 justify-start gap-2"
                onClick={() => setActionType("TRANSITION")}
                disabled={incident.allowed_transitions.length === 0}
              >
                <ArrowRightLeft className="h-4 w-4" /> Change Status
              </Button>
              {/* Comment Button */}
              <Button
                variant={actionType === "COMMENT" ? "default" : "outline"}
                className="flex-1 justify-start gap-2"
                onClick={() => setActionType("COMMENT")}
              >
                <MessageSquare className="h-4 w-4" /> Comment Only
              </Button>
            </div>
          </div>

          {/* Transition Dropdown (Only visible if TRANSITION selected) */}
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

          {/* Comment Box */}
          <div className="grid gap-2">
            <Label>Reasoning / Context</Label>
            <Textarea
              placeholder="e.g., Checked logs, identified CPU spike. Rolling back..."
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
            className={actionType === "TRANSITION" ? getActionColor(selectedState) : ""}
          >
            {loading ? "Updating..." : "Confirm Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}