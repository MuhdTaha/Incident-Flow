"use client";

import { Card, CardContent } from "@/components/ui/card";

type Incident = {
  severity: string;
  status: string;
};

interface IncidentStatsProps {
  incidents: Incident[];
}

export default function IncidentStats({ incidents }: IncidentStatsProps) {
  const highSevCount = incidents.filter((i) => i.severity === "SEV1").length;
  const inProgressCount = incidents.filter((i) => i.status === "INVESTIGATING").length;
  const activeCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  const statConfig = [
    {
      label: "High severity",
      value: highSevCount,
      badge: "SEV1",
      badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
      meta: "Critical incidents open",
      pulse: highSevCount > 0,
      pulseClass: "bg-red-400",
    },
    {
      label: "In progress",
      value: inProgressCount,
      badge: "LIVE",
      badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      meta: "Currently investigating",
      pulse: inProgressCount > 0,
      pulseClass: "bg-cyan-400",
    },
    {
      label: "Total active",
      value: activeCount,
      badge: "OPEN",
      badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      meta: "Not yet resolved",
      pulse: false,
      pulseClass: "bg-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {statConfig.map((stat) => (
        <Card key={stat.label} className="gap-0 py-3">
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {stat.label}
              </span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${stat.badgeClass}`}>
                {stat.badge}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{stat.value}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              {stat.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className={`auth-pulse-ring absolute inline-flex h-full w-full rounded-full ${stat.pulseClass}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${stat.pulseClass}`} />
                </span>
              )}
              {stat.meta}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
