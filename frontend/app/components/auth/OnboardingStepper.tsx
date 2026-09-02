"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingStepId = "account" | "verify" | "workspace";

const STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "verify", label: "Verify" },
  { id: "workspace", label: "Workspace" },
];

function stepIndex(id: OnboardingStepId) {
  return STEPS.findIndex((s) => s.id === id);
}

export function OnboardingStepper({ current }: { current: OnboardingStepId }) {
  const currentIdx = stepIndex(current);

  return (
    <ol className="mb-8 flex items-center gap-0" aria-label="Setup progress">
      {STEPS.map((step, idx) => {
        const complete = idx < currentIdx;
        const active = idx === currentIdx;

        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                  complete && "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
                  active && "bg-blue-600 text-white shadow-md shadow-blue-600/35 ring-4 ring-blue-100 dark:ring-blue-500/30",
                  !complete && !active && "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                )}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  active ? "text-blue-700 dark:text-cyan-300" : complete ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-500",
                  idx < currentIdx ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
