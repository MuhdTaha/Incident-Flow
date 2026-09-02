"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/app/components/auth/AuthShell";
import { OnboardingStepper, type OnboardingStepId } from "@/app/components/auth/OnboardingStepper";
import { PasswordField } from "@/app/components/auth/PasswordField";
import { cn } from "@/lib/utils";

type ViewState = "loading" | "signup" | "verify_email" | "org" | "success";

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "live.com",
]);

const AVATAR_TONES = [
  "from-blue-500 to-indigo-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-orange-500 to-rose-500",
  "from-emerald-500 to-teal-600",
];

function suggestedWorkspaceName(email: string, fullName: string): string {
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (domain && !GENERIC_EMAIL_DOMAINS.has(domain)) {
    const company = domain.split(".")[0] || "";
    if (company) {
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
  }
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `${first}'s team` : "My team";
}

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function firstNameFrom(fullName: string, email: string): string {
  const fromName = fullName.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  return email.split("@")[0] || "there";
}

export default function RegisterPage() {
  const router = useRouter();

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setViewState("signup");
        return;
      }

      if (!session.user.email_confirmed_at) {
        if (session.user.email) setEmail(session.user.email);
        setViewState("verify_email");
        return;
      }

      if (session.user.email) setEmail(session.user.email);
      if (session.user.user_metadata?.full_name) {
        setFullName(session.user.user_metadata.full_name);
      }
      setViewState("org");
    };

    checkUserStatus();
  }, []);

  useEffect(() => {
    if (viewState !== "org") return;
    setOrgName((current) => current.trim() || suggestedWorkspaceName(email, fullName));
  }, [viewState, email, fullName]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/register`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        setViewState("verify_email");
      } else if (data.session) {
        setViewState("org");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please log in again.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orgs/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: orgName.trim() }),
      });

      if (res.status === 409) {
        router.push("/");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create organization");
      }

      setViewState("success");
      window.setTimeout(() => router.push("/"), 1400);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stepperStep: OnboardingStepId =
    viewState === "org" || viewState === "success"
      ? "workspace"
      : viewState === "verify_email"
        ? "verify"
        : "account";

  const greeting = firstNameFrom(fullName, email);
  const previewName = orgName.trim() || "Your workspace";
  const initials = workspaceInitials(previewName);
  const tone = useMemo(() => avatarTone(previewName), [previewName]);

  if (viewState === "loading") {
    return (
      <AuthShell variant="signup">
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
          <p className="mt-3 text-sm">Checking your session…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="signup">
      {viewState !== "success" && <OnboardingStepper current={stepperStep} />}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {viewState === "signup" && (
        <div className="auth-in">
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Step 1 of 3</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Create your account
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Use a work email if you have one — we&apos;ll suggest a workspace name from it.
          </p>

          <form onSubmit={handleSignUp} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 bg-white dark:bg-slate-900/70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-white dark:bg-slate-900/70"
              />
            </div>
            <PasswordField
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              showStrength
              minLength={6}
            />

            <Button
              type="submit"
              disabled={loading}
              className="auth-cta h-11 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {viewState === "verify_email" && (
        <div className="auth-in text-center">
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Step 2 of 3</p>
          <div className="relative mx-auto mt-5 flex h-16 w-16 items-center justify-center">
            <span className="auth-pulse-ring absolute inset-0 rounded-full bg-blue-200 dark:bg-blue-500/40" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-cyan-400">
              <Mail className="h-7 w-7" />
            </div>
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Check your inbox
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">{email || "your email"}</span>.
            Open it, then come back here to name your workspace.
          </p>
          <Button
            variant="outline"
            className="mt-6 h-11 w-full bg-white dark:bg-slate-900/70"
            onClick={() => window.location.reload()}
          >
            I&apos;ve confirmed my email
          </Button>
          <p className="mt-4 text-xs text-slate-400">
            Don&apos;t see it? Check spam, or wait a minute and try again.
          </p>
        </div>
      )}

      {viewState === "org" && (
        <div className="auth-in">
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Step 3 of 3</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Hey {greeting} — name your workspace
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            This is the shared home for incidents, timelines, and post-mortems. You can rename it later.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/75 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/55">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md",
                  tone,
                )}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{previewName}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Shield className="h-3 w-3 text-blue-500" />
                  You&apos;ll join as Admin
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateOrg} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Workspace name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="orgName"
                  placeholder="Acme Engineering"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  autoFocus
                  className="h-11 bg-white dark:bg-slate-900/70 pl-9"
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Usually your company or team name — for example,{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">Acme</span> or{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">Platform SRE</span>.
              </p>
            </div>

            <ul className="space-y-2 rounded-xl bg-slate-100/80 px-4 py-3 dark:bg-white/5">
              <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                You become the organization admin
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                Invite engineers from the Admin console next
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                Declare your first incident from the dashboard
              </li>
            </ul>

            <Button
              type="submit"
              disabled={loading || !orgName.trim()}
              className="auth-cta h-11 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating workspace…
                </>
              ) : (
                <>
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <button
            type="button"
            className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={() => supabase.auth.signOut().then(() => {
              setOrgName("");
              setPassword("");
              setError(null);
              setViewState("signup");
            })}
          >
            Sign out and start over
          </button>
        </div>
      )}

      {viewState === "success" && (
        <div className="auth-in py-8 text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span className="auth-pulse-ring absolute inset-0 rounded-full bg-emerald-200 dark:bg-emerald-500/30" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {previewName} is ready
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Taking you to the dashboard to declare your first incident…
          </p>
        </div>
      )}
    </AuthShell>
  );
}
