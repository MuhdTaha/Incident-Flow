import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DetailedUserStat } from "@/app/admin/page";
import { CheckCircle2, MessageSquare, AlertTriangle, Briefcase } from "lucide-react";

interface UserStatsModalProps {
  user: DetailedUserStat | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserStatsModal({ user, isOpen, onClose }: UserStatsModalProps) {
  if (!user) return null;

  // Calculate a basic resolution rate
  const resolutionRate = user.assigned_count > 0 
    ? Math.round((user.resolved_count / user.assigned_count) * 100) 
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-50">Performance Scorecard</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-300">
            Detailed analytics for {user.full_name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          
          <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
              Total Assigned
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{user.assigned_count}</span>
          </div>

          <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
              Incidents Resolved
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{user.resolved_count}</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                {resolutionRate}% Rate
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <MessageSquare className="mr-2 h-4 w-4 text-indigo-400" />
              Comments Made
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{user.comments_made}</span>
          </div>

          <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              Escalations Triggered
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{user.escalations_triggered}</span>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}