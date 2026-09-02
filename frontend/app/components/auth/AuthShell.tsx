"use client";

import { CheckCircle2, Shield, Users } from "lucide-react";
import { BrandMark } from "@/app/components/BrandMark";
import { ThemeToggle } from "@/app/components/ThemeToggle";

type AuthShellProps = {
  children: React.ReactNode;
  variant?: "login" | "signup";
};

const HIGHLIGHTS = [
  {
    icon: Shield,
    title: "Guided response",
    body: "Move incidents through a defined lifecycle with no skipped states.",
  },
  {
    icon: CheckCircle2,
    title: "Audit-ready timeline",
    body: "Every comment, assignment, and status change is recorded.",
  },
  {
    icon: Users,
    title: "Built for teams",
    body: "Engineers, managers, and admins each get the right access.",
  },
];

function BrandPanel({ variant }: { variant: "login" | "signup" }) {
  const isLogin = variant === "login";

  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:flex-col bg-slate-950 text-white p-10 xl:p-12">
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-70" />
      <div className="auth-orb pointer-events-none absolute -top-24 -left-16 h-80 w-80 rounded-full bg-blue-600/40 blur-3xl" />
      <div className="auth-orb-alt pointer-events-none absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="auth-orb pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-10">
      <div>
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" iconClassName="h-5 w-5" />
          <span className="text-lg font-semibold tracking-tight">IncidentFlow</span>
        </div>

        <div className="mt-14 max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {isLogin ? "Welcome back" : "Onboarding"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-[2.6rem]">
            {isLogin
              ? "Stay in command when production breaks."
              : "Stand up an incident workspace for your team."}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            {isLogin
              ? "Pick up where you left off: declare, investigate, and close incidents with a full audit trail."
              : "Create an account, name your workspace, and declare your first incident within minutes."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="auth-float relative max-w-sm rounded-2xl border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-bold tracking-wide text-red-300">
              SEV1
            </span>
            <span className="flex items-center gap-1.5 text-xs text-cyan-300">
              <span className="relative flex h-2 w-2">
                <span className="auth-pulse-ring absolute inline-flex h-full w-full rounded-full bg-cyan-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Investigating
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-white">API latency spike in payments</p>
          <p className="mt-1 text-xs text-slate-400">Owner · Alex · opened 8m ago</p>
        </div>

        <div className="auth-float-delayed relative ml-8 max-w-sm rounded-2xl border border-white/10 bg-white/8 p-4 shadow-xl backdrop-blur-md">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Latest event
          </p>
          <p className="mt-2 text-sm text-slate-100">
            Status moved to <span className="font-medium text-emerald-300">Mitigated</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Recorded in the audit log · 2m ago</p>
        </div>
      </div>

      <ul className="space-y-4">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-sm text-slate-400">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
      </div>
    </aside>
  );
}

function MobileBrandBar() {
  return (
    <div className="relative overflow-hidden bg-slate-950 px-6 py-5 text-white lg:hidden">
      <div className="auth-orb pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-blue-500/40 blur-2xl" />
      <div className="auth-orb-alt pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-cyan-400/30 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <BrandMark className="h-9 w-9" iconClassName="h-4 w-4" />
        <div>
          <p className="font-semibold tracking-tight">IncidentFlow</p>
          <p className="text-xs text-slate-400">Incident management for engineering teams</p>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ children, variant = "login" }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel variant={variant} />
      <div
        className="relative flex flex-col bg-blue-50 dark:bg-slate-950"
      >
        <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
          <ThemeToggle />
        </div>
        <MobileBrandBar />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_at_top_right,rgba(147,197,253,0.5),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(125,211,252,0.4),transparent_50%)]" />
          <div className="auth-orb absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-300/50 blur-3xl dark:bg-blue-500/20" />
          <div className="auth-orb-alt absolute bottom-0 -left-16 h-64 w-64 rounded-full bg-sky-300/40 blur-3xl dark:bg-cyan-400/10" />
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="auth-in w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
