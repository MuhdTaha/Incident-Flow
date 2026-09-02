"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Clock, TrendingUp, Loader2, Zap, AlertOctagon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


type AnalyticsData = {
  time_window_days: number;
  mttr_hours: number;
  mtta_minutes: number;
  sla_breach_rate: number;
  total_breaches: number;
  volume_trend: { date: string; count: number }[];
};

export default function MetricsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30"); // Default to 30 days
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axisFill = isDark ? "#94a3b8" : "#475569";
  const gridStroke = isDark ? "#1e3a5f" : "#e2e8f0";

  // useCallback prevents unnecessary re-renders when the dependency changes
  const fetchData = useCallback(async (timeWindow: string) => {
    setLoading(true);
    try {
      // Pass the 'days' query parameter to the backend
      const res = await authFetch(`/admin/charts?days=${timeWindow}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount and whenever 'days' changes
  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  return (
    <div className="space-y-4">
      
      {/* Time Filter Control */}
      <div className="flex justify-end">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900/70 dark:border-white/10">
            <SelectValue placeholder="Select Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 justify-center py-12 text-slate-600 dark:text-slate-400">
          <Loader2 className="animate-spin h-5 w-5"/> Loading Analytics...
        </div>
      ) : !data ? (
        <div className="p-4 text-center text-red-500">Failed to load metrics.</div>
      ) : (
        <>
          {/* Top Row: KPIs */}
          <div className="grid gap-3 md:grid-cols-3">
            
            {/* KPI: MTTR */}
            <Card className="gap-0 py-3">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Mean Time to Resolve (MTTR)
                </CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {data.mttr_hours} <span className="text-base font-normal text-slate-600 dark:text-slate-400">hrs</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Creation to Resolution
                </p>
              </CardContent>
            </Card>

            {/* KPI: MTTA */}
            <Card className="gap-0 py-3">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Mean Time to Acknowledge (MTTA)
                </CardTitle>
                <Zap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {data.mtta_minutes} <span className="text-base font-normal text-slate-600 dark:text-slate-400">mins</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Creation to First Status Change
                </p>
              </CardContent>
            </Card>

            {/* KPI: SLA Breaches */}
            <Card className="gap-0 py-3">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  SLA Breach Rate
                </CardTitle>
                <AlertOctagon className={`h-4 w-4 ${data.sla_breach_rate > 10 ? 'text-red-500' : 'text-emerald-500'}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className={`text-2xl font-bold ${data.sla_breach_rate > 10 ? 'text-red-600' : 'text-slate-900 dark:text-slate-50'}`}>
                    {data.sla_breach_rate}%
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    ({data.total_breaches} incidents)
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Incidents exceeding SLA thresholds
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Bottom Row: Volume Trend Chart */}
          <Card className="gap-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Incident Volume (Last {days} Days)
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="h-[210px] w-full">
              {data.volume_trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 dark:text-slate-400 text-sm">
                  No incident data for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.volume_trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis 
                      dataKey="date" 
                      tick={{fontSize: 12, fill: axisFill}} 
                      axisLine={false}
                      tickLine={false}
                      // For > 7 days, showing a short date is better than day of the week
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return days === "7" 
                          ? date.toLocaleDateString(undefined, {weekday: 'short'})
                          : `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{fontSize: 12, fill: axisFill}} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        borderRadius: "12px",
                        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "none",
                        background: isDark ? "#0f172a" : "#fff",
                        color: isDark ? "#e2e8f0" : "#0f172a",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Incidents"
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      dot={days === "7" ? { r: 4, fill: "#06b6d4", strokeWidth: 2, stroke: "#fff" } : false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}