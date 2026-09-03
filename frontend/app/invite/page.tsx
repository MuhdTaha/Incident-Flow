"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/app/components/auth/AuthShell";
import { PasswordField } from "@/app/components/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api";
import {
  decodeJwtEmail,
  fetchCurrentProfile,
  peekAuthCode,
  peekAuthTokens,
  stripAuthParamsFromUrl,
  type AuthTokens,
} from "@/lib/auth-redirect";

function suggestedName(email: string | undefined, metadataName: unknown): string {
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  const local = (email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "";
  return local.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

type Phase = "boot" | "switch" | "form" | "invalid";

export default function AcceptInvitePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>("boot");
  const [switchFrom, setSwitchFrom] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [pendingTokens, setPendingTokens] = useState<AuthTokens | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const tokens = peekAuthTokens();
      const code = peekAuthCode();
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (tokens) {
        const tokenEmail = decodeJwtEmail(tokens.access_token);
        const currentEmail = existing?.user.email;
        if (
          currentEmail
          && tokenEmail
          && currentEmail.toLowerCase() !== tokenEmail.toLowerCase()
        ) {
          setSwitchFrom(currentEmail);
          setSwitchTo(tokenEmail);
          setPendingTokens(tokens);
          setPhase("switch");
          return;
        }
        const { error: sessionError } = await supabase.auth.setSession(tokens);
        stripAuthParamsFromUrl();
        if (sessionError) {
          setPhase("invalid");
          return;
        }
        setInviteEmail(tokenEmail);
        setPhase("form");
        return;
      }

      if (code) {
        if (existing?.user.email) {
          setSwitchFrom(existing.user.email);
          setSwitchTo(null);
          setPendingCode(code);
          setPhase("switch");
          return;
        }
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        stripAuthParamsFromUrl();
        if (codeError) {
          setPhase("invalid");
          return;
        }
        setPhase("form");
        return;
      }

      if (!existing) {
        setPhase("invalid");
        return;
      }

      const profile = await fetchCurrentProfile(existing.access_token);
      if (cancelled) return;
      if (profile && profile.invite_pending === false) {
        router.replace("/");
        return;
      }
      setPhase("form");
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!user || phase !== "form") return;
    setFullName((current) => current.trim() || suggestedName(user.email, user.user_metadata?.full_name));
  }, [user, phase]);

  const applyInviteSession = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
      if (pendingTokens) {
        const { error: sessionError } = await supabase.auth.setSession(pendingTokens);
        if (sessionError) throw sessionError;
        setInviteEmail(decodeJwtEmail(pendingTokens.access_token) || switchTo);
      } else if (pendingCode) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(pendingCode);
        if (codeError) throw codeError;
      }
      stripAuthParamsFromUrl();
      setPhase("form");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not open this invite");
      setPhase("invalid");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const name = fullName.trim();
      if (!name) throw new Error("Please enter your full name.");

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: name },
      });
      if (updateError) throw updateError;

      const res = await authFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: name }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : "Failed to save your profile");
      }

      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete invite");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "boot" || (phase === "form" && authLoading)) {
    return (
      <AuthShell variant="signup">
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
          <p className="mt-3 text-sm">Opening your invite…</p>
        </div>
      </AuthShell>
    );
  }

  if (phase === "switch") {
    return (
      <AuthShell variant="signup">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Invite</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            This invite is for a different account
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            You&apos;re signed in as{" "}
            <span className="font-medium text-slate-800 dark:text-slate-100">{switchFrom}</span>
            {switchTo ? (
              <>
                . The invite is for{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">{switchTo}</span>.
              </>
            ) : (
              ". Continue only if you want to leave this session and join with the invite."
            )}
          </p>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-7 space-y-3">
          <Button
            type="button"
            disabled={loading}
            onClick={() => void applyInviteSession()}
            className="auth-cta h-11 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Switching accounts…
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Continue as {switchTo || "the invited user"}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              stripAuthParamsFromUrl();
              router.push("/");
            }}
          >
            Stay signed in as {switchFrom}
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (phase === "invalid" || !user) {
    return (
      <AuthShell variant="signup">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Invite</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            This invite link is invalid or expired
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Ask an admin to send a new invite, or sign in if you already created an account.
          </p>
          <Button asChild className="mt-6 h-11 w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="signup">
      <div>
        <p className="text-sm font-medium text-blue-600 dark:text-cyan-400">Join your workspace</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Create your account
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          You were invited as{" "}
          <span className="font-medium text-slate-800 dark:text-slate-100">{inviteEmail || user.email}</span>.
          Set a name and password to join this organization.
        </p>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAccept} className="mt-7 space-y-4">
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
              Joining workspace…
            </>
          ) : (
            <>
              Join workspace
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
