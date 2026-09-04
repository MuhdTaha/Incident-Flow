"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/api";

type DeleteOrgDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  orgName: string;
  onDeleted: () => Promise<void> | void;
};

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export default function DeleteOrgDialog({
  isOpen,
  onClose,
  orgName,
  onDeleted,
}: DeleteOrgDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmation("");
    setError(null);
    setLoading(false);
  }, [isOpen]);

  const matches = confirmation.trim() === orgName.trim();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/orgs/current", {
        method: "DELETE",
        body: JSON.stringify({ name: confirmation.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(errorMessage(data.detail, "Failed to delete workspace"));
      }
      await onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace");
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            Delete workspace
          </DialogTitle>
          <DialogDescription>
            This permanently removes {orgName}, including teammates, incidents, and attachments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="grid gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Type the workspace name to confirm. This cannot be undone.</span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="delete-org-name">Workspace name</Label>
            <Input
              id="delete-org-name"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={orgName}
              autoComplete="off"
              disabled={loading}
              className="h-11 bg-white dark:bg-slate-900/70"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading || !matches}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
