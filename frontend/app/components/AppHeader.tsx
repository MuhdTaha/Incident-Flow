  "use client";

import { useEffect, useState } from "react";
import { Activity, Building2 } from "lucide-react";
import UserNav from "./UserNav";
import { authFetch } from "@/lib/api";
import Link from "next/link";

export default function AppHeader() {
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgProfile = async () => {
      try {
        const res = await authFetch("/orgs/org_profile");
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.name);
        }
      } catch (e) {
        console.error("Failed to fetch org details");
        setOrgName("N/A");
      } finally {
        setLoading(false);
      }
    };
    fetchOrgProfile();
  }, []);

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/60 bg-slate-50/50 pt-2 sticky top-0 z-10">
      <div className="flex items-center gap-6">
        {/* Logo Block - Clickable to Home */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="bg-slate-900 p-2 rounded-lg shadow-sm">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            IncidentFlow
          </h1>
        </Link>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-300 hidden md:block" />

        {/* Organization Context */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-slate-500">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Organization</span>
          </div>
          <div className="font-semibold text-slate-900 text-lg leading-tight h-6">
            {loading ? (
               <span className="inline-block h-4 w-24 bg-slate-200 animate-pulse rounded"></span>
            ) : (
               orgName
            )}
          </div>
        </div>
      </div>

      {/* User Navigation */}
      <div className="flex items-center gap-4"> 
        <UserNav />
      </div>
    </header>
  );
}