"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Clock, TrendingUp, Loader2 } from "lucide-react";

type AnalyticsData = {
  mttr_hours: number;
  volume_trend: { date: string; count: number }[];
};

export default function MetricsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await authFetch("/admin/analytics");
        if (res.ok) {
            const json = await res.json();
            setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch analytics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin h-4 w-4"/> Loading Analytics...</div>;
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      
      {/* KPI Card: MTTR (Takes up 2 columns) */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">
            Mean Time to Resolve
          </CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-slate-900">
            {data.mttr_hours} <span className="text-lg font-normal text-slate-500">hrs</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Avg time from creation to resolution
          </p>
        </CardContent>
      </Card>

      {/* Chart: Incident Volume (Takes up 5 columns) */}
      <Card className="lg:col-span-5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-500">
                Incident Volume (Last 7 Days)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.volume_trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {weekday: 'short'})}
              />
              <YAxis 
                allowDecimals={false} 
                tick={{fontSize: 12, fill: '#64748b'}} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}