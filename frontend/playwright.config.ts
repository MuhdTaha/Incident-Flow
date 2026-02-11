import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/__tests__/**'], // Ignore any unit tests in the __tests__ directory
  projects: [
    // Setup project
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Tell all tests to use the saved state from the setup project
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'], // Run setup before this project
    },
  ],
  use: {
    baseURL: 'http://localhost:3000',
  },
});