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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Trash2, UserCog } from "lucide-react";
import { authFetch } from "@/lib/api";

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type EditUserModalProps = {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditUserModal({ user, isOpen, onClose, onSuccess }: EditUserModalProps) {
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  // Delete State (Two-step)
  const [deleteStep, setDeleteStep] = useState<"IDLE" | "CONFIRM">("IDLE");

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setDeleteStep("IDLE");
    }
  }, [user, isOpen]);

  const handleUpdateRole = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch(`/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) throw new Error("Failed to update role");
      
      onSuccess();
      onClose();
    } catch (e) {
      alert("Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch(`/users/${user.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete");
      }
      
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Edit Employee
          </DialogTitle>
        </DialogHeader>

        {deleteStep === "IDLE" ? (
          /* --- EDIT VIEW --- */
          <div className="grid gap-6 py-4">
            <div className="grid gap-1">
              <Label className="text-xs text-slate-500">Employee Name</Label>
              <div className="font-medium text-slate-900">{user.full_name}</div>
              <div className="text-sm text-slate-500">{user.email}</div>
            </div>

            <div className="grid gap-2">
              <Label>Role / Access Level</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENGINEER">Engineer (Standard)</SelectItem>
                  <SelectItem value="MANAGER">Manager (Can Assign/Edit)</SelectItem>
                  <SelectItem value="ADMIN">Admin (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button 
                variant="ghost" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full justify-start pl-0"
                onClick={() => setDeleteStep("CONFIRM")}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove User from Organization...
              </Button>
            </div>
          </div>
        ) : (
          /* --- CONFIRM DELETE VIEW --- */
          <div className="py-6 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-slate-900">Remove {user.full_name}?</h3>
              <p className="text-sm text-slate-500 px-4">
                This action is permanent. Their assigned incidents will be unassigned.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {deleteStep === "IDLE" ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleUpdateRole} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setDeleteStep("IDLE")} 
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser} 
                disabled={loading}
              >
                {loading ? "Removing..." : "Confirm Removal"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}