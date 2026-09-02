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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { authFetch } from "@/lib/api";

type InviteRole = "ENGINEER" | "MANAGER" | "ADMIN";

type InviteUsersDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onInvited?: () => void;
};

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export default function InviteUsersDialog({
  isOpen,
  onClose,
  onInvited,
}: InviteUsersDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("ENGINEER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvited, setLastInvited] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setRole("ENGINEER");
    setError(null);
    setLastInvited(null);
    setLoading(false);
  }, [isOpen]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/orgs/invite", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(errorMessage(data.detail, "Failed to send invite"));
      }

      setLastInvited(email.trim());
      setEmail("");
      setRole("ENGINEER");
      onInvited?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <UserPlus className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
            Invite teammates
          </DialogTitle>
          <DialogDescription>
            Send an email with a link to create their account. They won’t appear as an active teammate until they join.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="grid gap-4">
          {lastInvited && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Invite sent to {lastInvited}. They stay pending until they join from the email.</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="h-11 bg-white dark:bg-slate-900/70"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
              <SelectTrigger id="invite-role" className="h-11 w-full bg-white dark:bg-slate-900/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENGINEER">Engineer (standard)</SelectItem>
                <SelectItem value="MANAGER">Manager (can assign / edit)</SelectItem>
                <SelectItem value="ADMIN">Admin (full access)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Skip for now
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Done
              </Button>
              <Button type="submit" disabled={loading || !email.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send invite"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
