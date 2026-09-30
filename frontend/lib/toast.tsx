"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "success";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type Listener = (toasts: ToastItem[]) => void;

const listeners = new Set<Listener>();
let items: ToastItem[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(items);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(message: string, variant: ToastVariant) {
  const existing = items.find((item) => item.message === message && item.variant === variant);
  if (existing) return;

  const id = nextId++;
  items = [...items, { id, message, variant }].slice(-4);
  emit();
  window.setTimeout(() => dismiss(id), 5000);
}

export const toast = {
  error(message: string) {
    push(message, "error");
  },
  success(message: string) {
    push(message, "success");
  },
};

export function clearToasts() {
  items = [];
  emit();
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setToasts);
    setToasts(items);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-3 text-sm shadow-lg backdrop-blur-md",
            item.variant === "error"
              ? "border-red-200 bg-red-50/95 text-red-800 dark:border-red-500/30 dark:bg-red-950/90 dark:text-red-100"
              : "border-emerald-200 bg-white/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900/95 dark:text-emerald-200",
          )}
        >
          {item.variant === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="flex-1 leading-snug">{item.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="rounded-md opacity-70 transition-opacity hover:opacity-100"
            onClick={() => dismiss(item.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
