import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Approval Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display approval list', async ({ page }) => {
    await page.goto('/phe-duyet');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('should filter approvals by status', async ({ page }) => {
    await page.goto('/phe-duyet');
    await page.waitForTimeout(3000);
    // Look for filter controls
    const statusFilter = page.locator('select, [data-testid="status-filter"], [role="combobox"]');
    if (await statusFilter.first().isVisible()) {
      await statusFilter.first().click();
      await page.waitForTimeout(500);
    }
  });
});
