import { hasWorkspace } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";

export type DemoRole = "engineer" | "admin";

type DemoAccount = {
  email: string;
  password: string;
  name: string;
  roleLabel: string;
  blurb: string;
};

/**
 * Public demo accounts documented in README and docs/DEMO.md.
 * The landing-page tour signs visitors in with these credentials.
 */
export const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  engineer: {
    email: "jordan.dev@company.com",
    password: "IncidentFlow-Demo-2026",
    name: "Jordan",
    roleLabel: "Engineer",
    blurb: "Declare an incident, comment, and move it through the lifecycle.",
  },
  admin: {
    email: "alex.admin@company.com",
    password: "IncidentFlow-Demo-2026",
    name: "Alex",
    roleLabel: "Admin",
    blurb: "Open the admin console for team metrics, roles, and invites.",
  },
};

export async function signInToDemo(role: DemoRole): Promise<void> {
  const account = DEMO_ACCOUNTS[role];
  await supabase.auth.signOut();

  const result = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (result.error) {
    throw result.error;
  }

  const token = result.data.session?.access_token;
  if (!token || !(await hasWorkspace(token))) {
    await supabase.auth.signOut();
    throw new Error(
      "The demo workspace isn't available right now. Try again shortly, or create your own.",
    );
  }
}
