"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Github,
  Linkedin,
  Mail,
  Menu,
  ScrollText,
  Shield,
  Sparkles,
  Timer,
  Workflow,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/app/components/BrandMark";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { getSevStyles } from "@/lib/incident-utils";
import { cn } from "@/lib/utils";
import { DemoWalkthrough } from "./DemoWalkthrough";

const FEATURES = [
  {
    icon: Workflow,
    title: "Enforced lifecycle",
    body: "Incidents move only along allowed paths, from detected through closed. Invalid jumps are rejected before they hit the record.",
  },
  {
    icon: ScrollText,
    title: "Immutable audit trail",
    body: "Status changes, comments, assignments, and uploads are stored with the change itself, so the timeline matches what actually happened.",
  },
  {
    icon: Shield,
    title: "Roles that match the work",
    body: "Engineers respond, managers reassign, and admins run the workspace. Permissions come from the application database, not the login token.",
  },
  {
    icon: Mail,
    title: "Invite the team",
    body: "Admins invite teammates by email. They join this organization instead of standing up a second one.",
  },
  {
    icon: Timer,
    title: "SLA escalation",
    body: "A background job watches incidents stuck in detected and escalates them when the severity window is breached.",
  },
  {
    icon: Sparkles,
    title: "AI post-mortems",
    body: "After an incident is resolved, generate a markdown report from the timeline and keep it with that organization.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Declare",
    body: "Capture the title, severity, and what broke. The incident starts as detected and shows up on the team queue.",
  },
  {
    n: "02",
    title: "Respond",
    body: "Transition status, leave comments, and attach logs. Each action is checked against the lifecycle and written to the audit log.",
  },
  {
    n: "03",
    title: "Learn",
    body: "Generate a post-mortem from that record. Admins can review response time, volume, and who is carrying the load.",
  },
];

const ROLES = [
  {
    name: "Engineer",
    body: "Declare incidents, move your own work forward, comment, and upload evidence.",
  },
  {
    name: "Manager",
    body: "Reassign owners, change severity, and remove incidents the team no longer needs.",
  },
  {
    name: "Admin",
    body: "Invite teammates, manage roles, read org analytics, and delete the workspace.",
  },
];

const PREVIEW_ROWS = [
  { sev: "SEV1", title: "Checkout timeouts after deploy", owner: "Jordan", status: "Investigating" },
  { sev: "SEV2", title: "Database connection pool exhausted", owner: "Sarah", status: "Detected" },
  { sev: "SEV3", title: "Search latency on catalog", owner: "Alex", status: "Mitigated" },
];

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Roles" },
];

export function LandingPage() {
  const { user } = useAuth();
  const [demoOpen, setDemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = Boolean(user);

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  function openDemo() {
    setMenuOpen(false);
    setDemoOpen(true);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-blue-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_at_top_left,rgba(147,197,253,0.55),transparent_52%),radial-gradient(ellipse_at_top_right,rgba(125,211,252,0.4),transparent_48%)]" />
        <div className="auth-orb absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-blue-300/50 blur-3xl dark:bg-blue-500/20" />
        <div className="auth-orb-alt absolute top-10 -right-24 h-[24rem] w-[24rem] rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-400/15" />
      </div>

      <header className="sticky top-0 z-40 border-b border-blue-100/70 bg-blue-50/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight">IncidentFlow</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex dark:text-slate-300">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-slate-900 dark:hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {signedIn ? (
              <Button asChild>
                <Link href="/dashboard">
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button onClick={openDemo}>Try the demo</Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-blue-100/70 px-4 py-3 md:hidden dark:border-white/10">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {item.label}
                </a>
              ))}
              {signedIn ? (
                <Button asChild className="mt-2">
                  <Link href="/dashboard">Open workspace</Link>
                </Button>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button onClick={openDemo}>Try the demo</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-24">
          <div className="auth-in">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-300">
              Incident management for engineering teams
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl sm:leading-[1.08] dark:text-white">
              Stay in command when production breaks.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Declare a production incident, move it through a defined lifecycle, and keep an
              audit trail the post-mortem can trust. Every organization sees only its own data.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button className="h-11 px-5" onClick={openDemo}>
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </Button>
              {signedIn ? (
                <Button variant="outline" className="h-11 bg-white/70 px-5 dark:bg-white/5" asChild>
                  <Link href="/dashboard">Open workspace</Link>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 bg-white/70 px-5 dark:bg-white/5" asChild>
                  <Link href="/register">Create a workspace</Link>
                </Button>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              The demo signs you into a shared workspace. No account setup.
            </p>
          </div>

          <ProductPreview />
        </section>

        <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">
              Features
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              The workflow, the record, and the review
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Built for a small engineering org that needs a real incident process, not another spreadsheet.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm shadow-blue-950/5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-md shadow-blue-500/25">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-blue-100/80 bg-white/70 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-cyan-300 dark:bg-cyan-400/15">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Isolated by organization</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Every incident, user, and file belongs to one workspace. A request for another
                  organization&apos;s data comes back as not found.
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">
              Engineer · Manager · Admin
            </p>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 px-4 py-8 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white sm:px-10">
            <div className="pointer-events-none absolute inset-0 auth-grid opacity-70" />
            <div className="auth-orb pointer-events-none absolute -top-20 -left-10 h-64 w-64 rounded-full bg-blue-600/40 blur-3xl" />
            <div className="auth-orb-alt pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-cyan-400/25 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                How it works
              </p>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
                From the first page to the post-mortem
              </h2>
              <ol className="mt-10 grid gap-6 md:grid-cols-3">
                {STEPS.map((step) => (
                  <li key={step.n} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                    <p className="font-mono text-sm text-cyan-300">{step.n}</p>
                    <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Detected", "Investigating", "Mitigated", "Resolved", "Postmortem", "Closed", "Escalated"].map(
                  (state) => (
                    <span
                      key={state}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                    >
                      {state}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">
              Access
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three roles, one workspace</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROLES.map((role) => (
              <article
                key={role.name}
                className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5"
              >
                <h3 className="text-base font-semibold">{role.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{role.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-white/80 px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-white/5 sm:px-10">
            <div className="auth-orb pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-400/20" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight">See a workspace that is already in motion</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                Walk through declare, respond, and review, then sign in as an engineer or an admin
                on the shared demo organization.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button className="h-11 px-5" onClick={openDemo}>
                  Start the demo
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign in with your own account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onDemo={openDemo} />
      <DemoWalkthrough open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="auth-in auth-in-2 relative sm:pt-4 sm:pl-8">
      <div className="auth-float absolute top-0 left-0 z-10 hidden w-52 rounded-2xl border border-white/15 bg-slate-950/90 p-3 text-white shadow-2xl backdrop-blur-md sm:block">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">SEV1</span>
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-300">
            <span className="relative flex h-2 w-2">
              <span className="auth-pulse-ring absolute inline-flex h-full w-full rounded-full bg-cyan-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            Investigating
          </span>
        </div>
        <p className="mt-2 text-sm font-medium">API latency spike in payments</p>
        <p className="mt-1 text-[11px] text-slate-400">Owner · Jordan · opened 8m ago</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-xl shadow-blue-950/10 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <BrandMark className="h-7 w-7" iconClassName="h-3.5 w-3.5" />
            <div>
              <p className="text-sm font-semibold">Incident queue</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Default Org</p>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Last updated just now</span>
        </div>
        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
          {PREVIEW_ROWS.map((row) => (
            <div key={row.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
              <Badge variant="outline" className={cn("h-6 px-1.5 text-[10px]", getSevStyles(row.sev))}>
                {row.sev}
              </Badge>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.owner}</p>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300">{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SiteFooter({ onDemo }: { onDemo: () => void }) {
  return (
    <footer className="relative border-t border-white/10 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <BrandMark />
            <span className="font-semibold tracking-tight">IncidentFlow</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            Multi-tenant incident management for engineering teams. Built by Muhammad Taha as an
            independent portfolio project.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="#features">Features</a></li>
            <li><a className="hover:text-white" href="#how-it-works">How it works</a></li>
            <li>
              <button type="button" className="hover:text-white" onClick={onDemo}>
                Try the demo
              </button>
            </li>
            <li><Link className="hover:text-white" href="/login">Sign in</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Project</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className="hover:text-white" href="https://github.com/MuhdTaha/Incident-Flow" target="_blank" rel="noreferrer">
                Source code
              </a>
            </li>
            <li><Link className="hover:text-white" href="/register">Create a workspace</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Connect</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                className="inline-flex items-center gap-2 hover:text-white"
                href="https://www.linkedin.com/in/muhdtaha"
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-2 hover:text-white"
                href="https://github.com/MuhdTaha"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          © {new Date().getFullYear()} Muhammad Taha. Chicago.
        </p>
      </div>
    </footer>
  );
}
