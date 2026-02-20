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
          <DialogTitle>Performance Scorecard</DialogTitle>
          <DialogDescription>
            Detailed analytics for {user.full_name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          
          <div className="flex flex-col p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center text-sm font-medium text-slate-500 mb-1">
              <Briefcase className="h-4 w-4 mr-2 text-blue-500" />
              Total Assigned
            </div>
            <span className="text-2xl font-bold text-slate-900">{user.assigned_count}</span>
          </div>

          <div className="flex flex-col p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center text-sm font-medium text-slate-500 mb-1">
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
              Incidents Resolved
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{user.resolved_count}</span>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                {resolutionRate}% Rate
              </span>
            </div>
          </div>

          <div className="flex flex-col p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center text-sm font-medium text-slate-500 mb-1">
              <MessageSquare className="h-4 w-4 mr-2 text-indigo-500" />
              Comments Made
            </div>
            <span className="text-2xl font-bold text-slate-900">{user.comments_made}</span>
          </div>

          <div className="flex flex-col p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center text-sm font-medium text-slate-500 mb-1">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              Escalations Triggered
            </div>
            <span className="text-2xl font-bold text-slate-900">{user.escalations_triggered}</span>
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}