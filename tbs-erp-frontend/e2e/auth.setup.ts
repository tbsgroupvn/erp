import { test as setup, expect } from '@playwright/test';

/**
 * Authentication setup — runs once before all test projects.
 *
 * Logs in as 3 different role profiles and persists their browser
 * storageState (cookies + localStorage) so that test projects can
 * start already authenticated.
 *
 * Auth mechanism:
 *   - POST /auth/login returns { user, tokens }
 *   - Frontend stores accessToken in Zustand (persisted subset in
 *     localStorage under key 'erp-auth-storage')
 *   - Cookies: 'erp-auth' (flag=1) and 'erp-role' (role name)
 *   - Middleware checks 'erp-auth' cookie for protected routes
 */

// ---------------------------------------------------------------------------
// Credentials from environment variables with local-dev defaults
// ---------------------------------------------------------------------------

const accounts = [
  {
    name: 'SALE',
    email: process.env.SALE_EMAIL || 'sale@nhaphangchinhngach.vn',
    password: process.env.SALE_PASSWORD || 'Test@123456',
    storagePath: '.auth/sale.json',
  },
  {
    name: 'CEO',
    email: process.env.CEO_EMAIL || 'ceo@nhaphangchinhngach.vn',
    password: process.env.CEO_PASSWORD || 'Test@123456',
    storagePath: '.auth/ceo.json',
  },
  {
    name: 'ACCOUNTANT',
    email: process.env.ACCOUNTANT_EMAIL || 'accountant@nhaphangchinhngach.vn',
    password: process.env.ACCOUNTANT_PASSWORD || 'Test@123456',
    storagePath: '.auth/accountant.json',
  },
] as const;

// ---------------------------------------------------------------------------
// Login helper — fills the login form and waits for redirect to /tong-quan
// ---------------------------------------------------------------------------

async function loginAndSaveState(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storagePath: string,
) {
  // Navigate to the login page
  await page.goto('/login');

  // Fill in credentials using accessible selectors
  // The form has: <label for="email">Email</label> and <label for="password">Mat khau</label>
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Mật khẩu/i).fill(password);

  // Submit the form
  await page.getByRole('button', { name: /Đăng nhập/i }).click();

  // Wait for successful redirect to dashboard
  await page.waitForURL('**/tong-quan', { timeout: 15_000 });

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/\/tong-quan/);

  // Save the authenticated state (cookies + localStorage)
  await page.context().storageState({ path: storagePath });
}

// ---------------------------------------------------------------------------
// Setup tests — one per role
// ---------------------------------------------------------------------------

for (const account of accounts) {
  setup(`authenticate as ${account.name}`, async ({ page }) => {
    await loginAndSaveState(
      page,
      account.email,
      account.password,
      account.storagePath,
    );
  });
}
