"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEMO_ACCOUNTS, signInToDemo, type DemoRole } from "@/lib/demo-accounts";
import { getSevStyles } from "@/lib/incident-utils";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    kicker: "The queue",
    title: "One list for everything still open",
    body: "Incidents live in a shared workspace. Filter by severity, status, or owner. The queue refreshes about every 30 seconds and shows when it last updated.",
  },
  {
    kicker: "Declare",
    title: "Open an incident in a few fields",
    body: "Give it a title, a severity from SEV1 to SEV4, and a short description. Engineers own what they create. Managers can reassign it later.",
  },
  {
    kicker: "Lifecycle",
    title: "Move forward only on allowed paths",
    body: "Detected, investigating, mitigated, resolved, postmortem, closed. Skipping a state is rejected. If a detected incident sits past its SLA, a background job escalates it.",
  },
  {
    kicker: "Record",
    title: "The timeline is the source of truth",
    body: "Comments, owner changes, and file uploads are written in the same transaction as the change. When the incident is resolved, that timeline becomes an AI post-mortem.",
  },
] as const;

type DemoWalkthroughProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DemoWalkthrough({ open, onOpenChange }: DemoWalkthroughProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [entering, setEntering] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastIndex = STEPS.length;
  const onLoginStep = step === lastIndex;
  const current = onLoginStep ? null : STEPS[step];

  useEffect(() => {
    if (!open) {
      setStep(0);
      setEntering(null);
      setError(null);
    }
  }, [open]);

  async function enter(role: DemoRole) {
    setEntering(role);
    setError(null);
    try {
      await signInToDemo(role);
      onOpenChange(false);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open the demo.";
      setError(message);
      setEntering(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(720px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <div className="relative border-b border-slate-200/80 bg-slate-950 px-6 py-5 pr-14 text-white dark:border-white/10">
          <DialogClose className="absolute top-4 right-4 rounded-md text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Product tour
          </p>
          <DialogTitle className="mt-1.5 text-xl font-semibold tracking-tight text-white">
            How IncidentFlow works
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-300">
            A short look at the workspace, then a one-click sign-in to the shared demo.
          </DialogDescription>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {Array.from({ length: lastIndex + 1 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  index <= step ? "bg-cyan-400" : "bg-white/15",
                )}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {current ? (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-cyan-400">
                  Step {step + 1} of {lastIndex + 1} · {current.kicker}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {current.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {current.body}
                </p>
              </div>
              <StepPreview step={step} />
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-cyan-400">
                Step {lastIndex + 1} of {lastIndex + 1} · Enter
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Open the live demo workspace
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                You&apos;ll sign in to a shared workspace that already has incidents, comments,
                and timelines. Other visitors see the same queue, so leave those examples in place.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(Object.keys(DEMO_ACCOUNTS) as DemoRole[]).map((role) => {
                  const account = DEMO_ACCOUNTS[role];
                  const busy = entering === role;
                  const disabled = entering !== null;
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={disabled}
                      onClick={() => void enter(role)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
                        role === "engineer"
                          ? "border-blue-200 bg-blue-50/80 hover:border-blue-300 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:hover:border-cyan-300/50"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-50">
                          {account.name}
                        </span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-slate-950 dark:text-cyan-300">
                          {account.roleLabel}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {account.email}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {account.blurb}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-cyan-300">
                        {busy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in…
                          </>
                        ) : (
                          <>
                            Continue as {account.name}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-6 py-4 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0 || entering !== null}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {onLoginStep ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Choose a role to enter</p>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-600 dark:text-slate-300"
                onClick={() => setStep(lastIndex)}
              >
                Skip to sign-in
              </Button>
              <Button type="button" onClick={() => setStep((value) => value + 1)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepPreview({ step }: { step: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950">
      {step === 0 && <QueuePreview />}
      {step === 1 && <DeclarePreview />}
      {step === 2 && <LifecyclePreview />}
      {step === 3 && <TimelinePreview />}
    </div>
  );
}

function QueuePreview() {
  const rows = [
    { sev: "SEV1", title: "Checkout timeouts", status: "Investigating" },
    { sev: "SEV2", title: "Database pool", status: "Detected" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Queue</p>
      {rows.map((row) => (
        <div key={row.title} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-white/5">
          <div className="min-w-0">
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", getSevStyles(row.sev))}>
              {row.sev}
            </Badge>
            <p className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">{row.title}</p>
          </div>
          <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{row.status}</span>
        </div>
      ))}
    </div>
  );
}

function DeclarePreview() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">New incident</p>
      <div className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-white/10 dark:text-slate-200">
        Checkout latency spike
      </div>
      <div className="flex gap-1.5">
        <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
          SEV2
        </span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">
          SEV1
        </span>
      </div>
      <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
        p99 on checkout crossed 2s after the payments deploy.
      </div>
    </div>
  );
}

function LifecyclePreview() {
  const states = ["Detected", "Investigating", "Mitigated", "Resolved"];
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Allowed path</p>
      <ol className="mt-2 space-y-1.5">
        {states.map((state, index) => (
          <li key={state} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                index < 2
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
              )}
            >
              {index + 1}
            </span>
            <span className={index === 1 ? "font-medium text-slate-900 dark:text-slate-50" : "text-slate-500 dark:text-slate-400"}>
              {state}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Audit log</p>
      <div className="flex gap-2 text-xs">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
        <p className="text-slate-700 dark:text-slate-200">Status moved to Investigating</p>
      </div>
      <div className="flex gap-2 text-xs">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <p className="text-slate-700 dark:text-slate-200">Comment recorded on the timeline</p>
      </div>
    </div>
  );
}
