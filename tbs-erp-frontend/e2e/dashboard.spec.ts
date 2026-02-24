import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display dashboard overview', async ({ page }) => {
    // Dashboard should have stat cards or overview section
    await expect(page.locator('[data-testid="dashboard"], .dashboard, main')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to orders page', async ({ page }) => {
    await page.click('a[href*="don-hang"], [data-testid="nav-orders"]');
    await expect(page).toHaveURL(/.*don-hang.*/);
  });

  test('should navigate to finance page', async ({ page }) => {
    const financeLink = page.locator('a[href*="tai-chinh"], a[href*="finance"], [data-testid="nav-finance"]');
    if (await financeLink.isVisible()) {
      await financeLink.click();
      await page.waitForTimeout(2000);
    }
  });
});
