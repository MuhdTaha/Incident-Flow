#!/usr/bin/env node
/**
 * Make sure the Playwright user can sign in.
 * Invited / unconfirmed Auth users fail with "Invalid login credentials".
 * When SUPABASE_KEY (secret / service_role) is set, reset password + confirm email.
 */

const url = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
const serviceKey = (process.env.SUPABASE_KEY || "").trim();
const email = (process.env.E2E_USER_EMAIL || "").trim();
const password = process.env.E2E_USER_PASSWORD || "";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!url || !anonKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are required.");
}
if (!email || !password) {
  fail("E2E_USER_EMAIL and E2E_USER_PASSWORD are required.");
}
if (password.length < 6) {
  fail("E2E_USER_PASSWORD must be at least 6 characters (Supabase Auth minimum).");
}

async function signIn() {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (response.ok) return { ok: true };
  let detail = await response.text();
  try {
    const body = JSON.parse(detail);
    detail = body.error_description || body.msg || body.message || detail;
  } catch {
    // keep raw text
  }
  return { ok: false, status: response.status, detail: String(detail).slice(0, 400) };
}

async function adminFetch(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(
      `Supabase admin ${options.method || "GET"} ${path} failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
  return data;
}

async function findUserId() {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const data = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = Array.isArray(data.users) ? data.users : [];
    const match = users.find((user) => String(user.email || "").toLowerCase() === target);
    if (match?.id) return match.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function repairUser() {
  if (!serviceKey) {
    fail(
      "E2E sign-in failed and SUPABASE_KEY is not set. Add the Supabase secret/service_role key as GitHub Actions secret SUPABASE_KEY, or confirm E2E_USER_EMAIL exists in Auth with that password (invite-only users cannot sign in).",
    );
  }
  if (serviceKey.startsWith("sb_publishable_") || serviceKey.startsWith("sb_anon_")) {
    fail("SUPABASE_KEY is the publishable/anon key. Use the secret / service_role key.");
  }

  const existingId = await findUserId();
  if (existingId) {
    await adminFetch(`/auth/v1/admin/users/${existingId}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    console.log(`Reset password and confirmed email for ${email}`);
    return;
  }

  await adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  console.log(`Created confirmed Auth user ${email}`);
}

async function main() {
  const first = await signIn();
  if (first.ok) {
    console.log(`E2E user ${email} can sign in`);
    return;
  }

  console.log(`E2E sign-in failed (${first.status}): ${first.detail}`);
  await repairUser();

  const second = await signIn();
  if (!second.ok) {
    fail(`E2E user still cannot sign in after reset (${second.status}): ${second.detail}`);
  }
  console.log(`E2E user ${email} can sign in after reset`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
