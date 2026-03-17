import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for TBS ERP Frontend E2E tests.
 *
 * Port mapping (Docker dev):
 *   Frontend: http://localhost:3000
 *   Backend API: http://localhost:3001/api/v1
 *
 * Run: npx playwright test
 * UI:  npx playwright test --ui
 */

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',

  /* Fail the build on CI if test.only is left in source code. */
  forbidOnly: CI,

  /* Retry on CI only to surface flaky tests locally. */
  retries: CI ? 2 : 0,

  /* Parallelism: conservative on CI, half-cores locally. */
  workers: CI ? 1 : '50%',
  fullyParallel: true,

  /* Timeouts */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Reporters */
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }], ['list']],

  /* Global setup for test data seeding (optional). */
  globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),

  /* Shared settings for all projects. */
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace on first retry to help debug CI failures. */
    trace: 'on-first-retry',

    /* Capture screenshot only when a test fails. */
    screenshot: 'only-on-failure',

    /* Record video but keep only on failure to save disk space. */
    video: 'retain-on-failure',

    /* Use baseURL-relative navigation everywhere. */
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    /* ------------------------------------------------------------------ */
    /* Setup project: authenticates users and saves storageState files.    */
    /* ------------------------------------------------------------------ */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    /* ------------------------------------------------------------------ */
    /* Desktop Chrome — primary browser.                                   */
    /* ------------------------------------------------------------------ */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/sale.json',
      },
      dependencies: ['setup'],
    },

    /* ------------------------------------------------------------------ */
    /* Desktop Firefox — cross-browser coverage.                           */
    /* ------------------------------------------------------------------ */
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.auth/sale.json',
      },
      dependencies: ['setup'],
    },

    /* ------------------------------------------------------------------ */
    /* Mobile Chrome — responsive / touch testing.                         */
    /* ------------------------------------------------------------------ */
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/sale.json',
      },
      dependencies: ['setup'],
    },
  ],

  /**
   * Automatically start the dev server if not already running.
   * Uses port 3000 to match the Docker setup (frontend=3000, backend=3001).
   * If running locally without Docker, set BASE_URL=http://localhost:3001 and
   * the webServer will be skipped via reuseExistingServer.
   */
  webServer: CI
    ? undefined
    : {
        command: 'npx next dev -p 3000',
        url: process.env.BASE_URL || 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
