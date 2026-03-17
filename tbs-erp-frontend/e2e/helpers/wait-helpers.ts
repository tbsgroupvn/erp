/**
 * Common wait/assertion utilities for TBS ERP E2E tests.
 *
 * IMPORTANT: Never use page.waitForTimeout() — it creates flaky tests.
 * All waits should be web-first (auto-retrying assertions or event-based waits).
 */

import { expect, type Page, type Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Navigation waits
// ---------------------------------------------------------------------------

/**
 * Wait for the dashboard to fully load (stats cards visible).
 */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/tong-quan/);
  // Wait for at least one stat card or heading to appear
  await expect(
    page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })),
  ).toBeVisible();
}

/**
 * Wait for a data table to finish loading (skeleton/spinner gone, rows visible).
 */
export async function waitForTableLoaded(page: Page): Promise<void> {
  // Wait for loading indicators to disappear
  const spinner = page.locator('[data-testid="loading-spinner"]');
  // If spinner exists, wait for it to detach; otherwise proceed
  if (await spinner.isVisible().catch(() => false)) {
    await expect(spinner).toBeHidden({ timeout: 15_000 });
  }

  // Verify table has at least the header row
  await expect(
    page.getByRole('table').or(page.locator('[data-testid="data-table"]')),
  ).toBeVisible();
}

/**
 * Wait for a toast notification to appear with the given text.
 */
export async function waitForToast(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toastLocator).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait for a toast notification to disappear.
 */
export async function waitForToastDismissed(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: text });
  await expect(toastLocator).toBeHidden({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Form waits
// ---------------------------------------------------------------------------

/**
 * Wait for a form submission to complete (button stops being disabled/busy).
 */
export async function waitForSubmitComplete(
  submitButton: Locator,
): Promise<void> {
  // Wait for the button to become enabled again (form done processing)
  await expect(submitButton).toBeEnabled({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Network waits
// ---------------------------------------------------------------------------

/**
 * Wait for a specific API response pattern.
 * Useful when you need to wait for data to load after an action.
 *
 * @example
 *   await waitForApiResponse(page, '/api/v1/orders');
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern) && response.status() < 400;
      }
      return urlPattern.test(url) && response.status() < 400;
    },
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// Dialog waits
// ---------------------------------------------------------------------------

/**
 * Wait for a confirmation dialog to appear and click OK/Cancel.
 */
export async function handleConfirmDialog(
  page: Page,
  action: 'confirm' | 'cancel',
): Promise<void> {
  const dialog = page.locator('[data-testid="confirm-dialog"]').or(
    page.getByRole('alertdialog'),
  );
  await expect(dialog).toBeVisible();

  if (action === 'confirm') {
    await dialog
      .getByRole('button', { name: /Xác nhận|Đồng ý|OK|Có/i })
      .click();
  } else {
    await dialog
      .getByRole('button', { name: /Hủy|Không|Cancel/i })
      .click();
  }
}
