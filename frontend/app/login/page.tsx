"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/app/components/auth/AuthShell";
import { PasswordField } from "@/app/components/auth/PasswordField";
import { hasWorkspace } from "@/lib/auth-redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function bounceIfSignedIn() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      if (await hasWorkspace(session.access_token)) {
        router.replace("/");
        return;
      }
      router.replace("/register");
    }

    void bounceIfSignedIn();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (result.error) throw result.error;

      const session = result.data.session;
      if (session && !(await hasWorkspace(session.access_token))) {
        router.push("/register");
        return;
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthShell variant="login">
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
          <p className="mt-3 text-sm">Checking your session…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="login">
      <div>
        <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Sign in</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Enter your work email to open your team&apos;s workspace.
        </p>
      </div>

      <form onSubmit={handleSignIn} className="mt-8 space-y-4">
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
          autoComplete="current-password"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="auth-cta h-11 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
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
        New to IncidentFlow?{" "}
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300">
          Create a workspace
        </Link>
      </p>
    </AuthShell>
  );
}
