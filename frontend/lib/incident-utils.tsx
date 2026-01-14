import { 
  AlertCircle, 
  Activity, 
  ShieldAlert, 
  CheckCircle, 
  Clock 
} from "lucide-react";

/**
 * Returns Tailwind CSS classes based on incident severity levels.
 */
export const getSevStyles = (sev: string) => {
  switch (sev) {
    case "SEV1": 
      return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-bold";
    case "SEV2": 
      return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100";
    case "SEV3": 
      return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
    case "SEV4":
      return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";
    default: 
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
};

/**
 * Returns the appropriate Lucide icon component for a given status.
 */
export const getStatusIcon = (status: string) => {
  const iconProps = "h-4 w-4";
  
  switch (status) {
    case "DETECTED": 
      return <AlertCircle className={`${iconProps} text-orange-500`} />;
    case "INVESTIGATING": 
      return <Activity className={`${iconProps} text-blue-500 animate-pulse`} />;
    case "MITIGATED": 
      return <ShieldAlert className={`${iconProps} text-green-500`} />;
    case "RESOLVED": 
      return <CheckCircle className={`${iconProps} text-slate-500`} />;
    default: 
      return <Clock className={`${iconProps} text-slate-400`} />;
  }
};