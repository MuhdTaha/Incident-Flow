import { test, expect } from '@playwright/test';

test('User can view dashboard data', async ({ page }) => {
  // Page starts with the cookies/storage from auth.setup.ts
  await page.goto('/');
  
  await expect(page.getByText('IncidentFlow')).toBeVisible();
  // You can now jump straight to testing the EDA features or charts
});