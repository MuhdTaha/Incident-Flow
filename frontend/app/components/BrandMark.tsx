import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-md shadow-blue-500/30",
        className ?? "h-8 w-8",
      )}
    >
      <Activity className={cn("text-white", iconClassName ?? "h-4 w-4")} />
    </div>
  );
}
