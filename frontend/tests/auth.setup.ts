import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Workers load this file in a separate process; ensure frontend/.env is applied in CI too.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const authFile = 'playwright/.auth/user.json';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to frontend/.env locally or configure it as a GitHub Actions secret in CI.`,
    );
  }
  return value;
}

setup('authenticate', async ({ page, context }) => {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  const email = requireEnv('E2E_USER_EMAIL');
  const password = requireEnv('E2E_USER_PASSWORD');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`E2E sign-in failed: ${error.message}`);
  }
  if (!data.session) {
    throw new Error('E2E sign-in succeeded but returned no session');
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await context.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey, session: data.session },
  );

  await page.goto('/');
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  await expect(page.getByText('IncidentFlow')).toBeVisible({ timeout: 15_000 });

  await context.storageState({ path: authFile });
});
