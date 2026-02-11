import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  await page.getByLabel('Email').fill('mohd.taha75@gmail.com');
  await page.getByLabel('Password').fill('abcd1234');

  await page.getByRole('button', { name: /login|submit|sign in/i }).click();

  // Wait for the dashboard to load to ensure login finished
  await expect(page).toHaveURL('/');

  // End-to-end reliability: Save the signed-in state
  await page.context().storageState({ path: authFile });
});