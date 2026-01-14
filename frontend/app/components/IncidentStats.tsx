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
  // Logic is centralized here instead of cluttering the Dashboard's render
  const highSevCount = incidents.filter((i) => i.severity === "SEV1").length;
  const inProgressCount = incidents.filter((i) => i.status === "INVESTIGATING").length;
  const activeCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  const statConfig = [
    {
      label: "High Severity",
      value: highSevCount,
      borderColor: "border-l-red-500",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      borderColor: "border-l-blue-500",
    },
    {
      label: "Total Active",
      value: activeCount,
      borderColor: "border-l-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statConfig.map((stat) => (
        <Card key={stat.label} className={`border-l-4 ${stat.borderColor} shadow-sm`}>
          <CardContent className="pt-5">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
              {stat.label}
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}