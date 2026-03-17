import { test, expect } from '../fixtures';
import { waitForTableLoaded } from '../helpers/wait-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the page to fully settle — loading spinners gone, charts rendered.
 * Uses web-first assertions only (no waitForTimeout).
 */
async function waitForPageSettled(page: import('@playwright/test').Page): Promise<void> {
  // Wait for main content to be visible
  await expect(page.locator('main').or(page.locator('[role="main"]'))).toBeVisible({
    timeout: 15_000,
  });

  // Dismiss loading spinners
  const spinner = page.locator('[data-testid="loading-spinner"], [data-loading="true"]');
  await expect(spinner).toHaveCount(0, { timeout: 15_000 }).catch(() => {
    // Some pages may not use these data attributes — proceed regardless
  });

  // Wait for skeleton placeholders to disappear
  const skeleton = page.locator('[data-slot="skeleton"], .animate-pulse').first();
  if (await skeleton.isVisible().catch(() => false)) {
    await expect(skeleton).toBeHidden({ timeout: 15_000 }).catch(() => {});
  }

  // Allow any trailing animations to finish
  await page.evaluate(() => document.fonts.ready);
}

// ---------------------------------------------------------------------------
// Visual Regression - Dashboard
// ---------------------------------------------------------------------------

test.describe('Visual Regression - Dashboard', () => {
  test('sales dashboard should match snapshot', async ({ salePage }) => {
    await salePage.goto('/tong-quan');

    // Wait for dashboard greeting and data
    await expect(salePage.getByText(/Xin chào/i)).toBeVisible({ timeout: 15_000 });
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('sales-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        // Mask stat card values (numbers change between runs)
        salePage.locator('.text-2xl.font-bold'),
        salePage.locator('.text-3xl'),
      ],
    });
  });

  test('ceo dashboard should match snapshot', async ({ ceoPage }) => {
    await ceoPage.goto('/tong-quan');

    await expect(ceoPage.getByText(/Xin chào/i)).toBeVisible({ timeout: 15_000 });
    await waitForPageSettled(ceoPage);

    await expect(ceoPage).toHaveScreenshot('ceo-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        ceoPage.locator('time'),
        ceoPage.locator('[data-dynamic]'),
        ceoPage.locator('.text-2xl.font-bold'),
        ceoPage.locator('.text-3xl'),
        // Mask chart canvases (data-dependent rendering)
        ceoPage.locator('canvas'),
        ceoPage.locator('.recharts-wrapper'),
      ],
    });
  });

  test('finance dashboard should match snapshot', async ({ accountantPage }) => {
    await accountantPage.goto('/tong-quan');

    await expect(accountantPage.getByText(/Xin chào/i)).toBeVisible({ timeout: 15_000 });
    await waitForPageSettled(accountantPage);

    await expect(accountantPage).toHaveScreenshot('finance-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        accountantPage.locator('time'),
        accountantPage.locator('[data-dynamic]'),
        accountantPage.locator('.text-2xl.font-bold'),
        accountantPage.locator('.text-3xl'),
        accountantPage.locator('canvas'),
        accountantPage.locator('.recharts-wrapper'),
      ],
    });
  });

  test('login page should match snapshot', async ({ page }) => {
    await page.goto('/login');

    // Wait for the login form to be fully rendered
    await expect(page.getByRole('button', { name: /Đăng nhập/i })).toBeVisible();

    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('order list should match snapshot', async ({ salePage }) => {
    await salePage.goto('/don-hang');
    await waitForTableLoaded(salePage);
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('order-list.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        // Mask dynamic data: timestamps, amounts, order codes
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('table tbody td:nth-child(1)'), // Order codes
        salePage.locator('table tbody td:last-child'),    // Action buttons may change
      ],
    });
  });

  test('customer list should match snapshot', async ({ salePage }) => {
    await salePage.goto('/khach-hang');
    await waitForTableLoaded(salePage);
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('customer-list.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('table tbody td:nth-child(1)'), // Customer codes
        salePage.locator('table tbody td:nth-child(2)'), // Customer names
      ],
    });
  });

  test('container page should match snapshot', async ({ salePage }) => {
    await salePage.goto('/container');
    await waitForTableLoaded(salePage);
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('container-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('table tbody td:nth-child(1)'), // Container codes
        salePage.locator('table tbody td:nth-child(6)'), // Dates
        salePage.locator('table tbody td:nth-child(7)'), // Created dates
      ],
    });
  });

  test('dashboard should render correctly on mobile viewport', async ({ salePage }) => {
    await salePage.setViewportSize({ width: 375, height: 812 });
    await salePage.goto('/tong-quan');

    await expect(salePage.getByText(/Xin chào/i)).toBeVisible({ timeout: 15_000 });
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('.text-2xl.font-bold'),
        salePage.locator('.text-3xl'),
        salePage.locator('canvas'),
        salePage.locator('.recharts-wrapper'),
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Visual Regression - Finance Pages
// ---------------------------------------------------------------------------

test.describe('Visual Regression - Finance', () => {
  test('invoice page should match snapshot', async ({ accountantPage }) => {
    await accountantPage.goto('/tai-chinh/hoa-don');
    await waitForTableLoaded(accountantPage);
    await waitForPageSettled(accountantPage);

    await expect(accountantPage).toHaveScreenshot('invoice-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        accountantPage.locator('time'),
        accountantPage.locator('[data-dynamic]'),
        accountantPage.locator('.text-2xl.font-bold'), // Summary card counts
        accountantPage.locator('table tbody'),          // Table data is dynamic
      ],
    });
  });

  test('payment voucher page should match snapshot', async ({ accountantPage }) => {
    await accountantPage.goto('/tai-chinh/phieu-thu-chi');
    await waitForTableLoaded(accountantPage);
    await waitForPageSettled(accountantPage);

    await expect(accountantPage).toHaveScreenshot('voucher-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        accountantPage.locator('time'),
        accountantPage.locator('[data-dynamic]'),
        accountantPage.locator('table tbody'),
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Visual Regression - Responsive
// ---------------------------------------------------------------------------

test.describe('Visual Regression - Responsive', () => {
  test('order list should render correctly on tablet viewport', async ({ salePage }) => {
    await salePage.setViewportSize({ width: 768, height: 1024 });
    await salePage.goto('/don-hang');
    await waitForTableLoaded(salePage);
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('order-list-tablet.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('table tbody'),
      ],
    });
  });

  test('container page should render correctly on mobile viewport', async ({ salePage }) => {
    await salePage.setViewportSize({ width: 375, height: 812 });
    await salePage.goto('/container');
    await waitForTableLoaded(salePage);
    await waitForPageSettled(salePage);

    await expect(salePage).toHaveScreenshot('container-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [
        salePage.locator('time'),
        salePage.locator('[data-dynamic]'),
        salePage.locator('table tbody'),
      ],
    });
  });
});
