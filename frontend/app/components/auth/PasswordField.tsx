"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoComplete?: string;
  showStrength?: boolean;
  minLength?: number;
  required?: boolean;
};

function scorePassword(password: string): number {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, 3);
}

export function PasswordField({
  id,
  value,
  onChange,
  label = "Password",
  autoComplete = "current-password",
  showStrength = false,
  minLength,
  required = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => scorePassword(value), [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="h-11 bg-white dark:bg-slate-900/70 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  strength >= step
                    ? strength === 1
                      ? "bg-orange-400"
                      : strength === 2
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            ))}
          </div>
          <p
            className={cn(
              "text-xs",
              strength === 0 && "text-slate-500",
              strength === 1 && "text-orange-600",
              strength === 2 && "text-amber-600",
              strength === 3 && "text-emerald-600",
            )}
          >
            {strength === 0 && "Too short — use at least 6 characters"}
            {strength === 1 && "Weak — add length, mixed case, or a number"}
            {strength === 2 && "Fair — a bit longer will make this strong"}
            {strength === 3 && "Strong password"}
          </p>
        </div>
      )}
    </div>
  );
}
