"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import UserNav from "./UserNav";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

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
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-blue-100/70 dark:border-white/10">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <BrandMark />
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            IncidentFlow
          </h1>
        </Link>

        <div className="h-6 w-px bg-blue-100 dark:bg-white/10 hidden md:block" />

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300">
            <Building2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Workspace</span>
          </div>
          <div className="font-semibold text-slate-900 dark:text-slate-50 text-sm leading-tight h-5">
            {loading ? (
               <span className="inline-block h-4 w-24 bg-blue-100 dark:bg-blue-500/20 animate-pulse rounded"></span>
            ) : (
               orgName
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
