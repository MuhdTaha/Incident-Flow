"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, AlertCircle, Lock } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  
  // States: 'loading' | 'signup' | 'verify_email' | 'org'
  const [viewState, setViewState] = useState<"loading" | "signup" | "verify_email" | "org">("loading");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  // 1. ON MOUNT: Determine User State
  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // New User -> Show Signup
        setViewState("signup");
        return;
      }

      // User has a session. Check if they are verified.
      // Supabase's 'user.email_confirmed_at' is null if unverified.
      // Note: In development, this might be auto-confirmed depending on Supabase settings.
      if (!session.user.email_confirmed_at) {
        setViewState("verify_email");
        return;
      }

      // User is verified. Now we check if they already have an Org.
      setViewState("org");
      
      // Pre-fill email/name if available
      if (session.user.email) setEmail(session.user.email);
      if (session.user.user_metadata?.full_name) setFullName(session.user.user_metadata.full_name);
    };

    checkUserStatus();
  }, []);

  // Step 1: Sign Up
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
          // Redirect back to this page after email verification
          emailRedirectTo: `${window.location.origin}/register`, 
        },
      });

      if (signUpError) throw signUpError;

      if (data.user && !data.session) {
        // Session is null -> Email confirmation required
        setViewState("verify_email");
      } else if (data.session) {
        // Auto-confirmed (Dev mode) -> Go to Org Setup
        setViewState("org");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Org
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
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: orgName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        // If 409 Conflict, it might mean user already exists/has org. 
        // We could handle that, but generic error is fine for now.
        throw new Error(errorData.detail || "Failed to create organization");
      }

      // Success!
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER LOGIC ---

  if (viewState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        
        {/* HEADER */}
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6 text-blue-600" />
            IncidentFlow
          </CardTitle>
          <CardDescription className="text-center">
            {viewState === "signup" && "Create an account to get started."}
            {viewState === "verify_email" && "We sent you a confirmation link."}
            {viewState === "org" && "Name your workspace to complete setup."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* VIEW: SIGN UP */}
          {viewState === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  placeholder="John Doe" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Create Account"}
              </Button>
            </form>
          )}

          {/* VIEW: VERIFY EMAIL */}
          {viewState === "verify_email" && (
            <div className="flex flex-col items-center space-y-4 py-4 text-center">
              <div className="bg-blue-50 p-3 rounded-full">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm text-slate-600">
                We have sent a verification link to <span className="font-semibold">{email}</span>.
                Please check your inbox and click the link to continue.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                I've verified my email
              </Button>
            </div>
          )}

          {/* VIEW: CREATE ORG */}
          {viewState === "org" && (
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input 
                  id="orgName" 
                  placeholder="Acme Corp" 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required 
                  autoFocus
                />
                <p className="text-xs text-slate-500">
                  This will be the name of your shared workspace.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Complete Setup"}
              </Button>
            </form>
          )}
        </CardContent>
        
        {/* FOOTER */}
        <CardFooter className="justify-center">
          {viewState === "signup" && (
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          )}
          {viewState === "org" && (
            <Button 
              variant="link" 
              className="text-sm text-slate-500"
              onClick={() => supabase.auth.signOut().then(() => setViewState("signup"))}
            >
              Sign out and create new account
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}