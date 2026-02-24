import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Warehouse VN', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display warehouse page', async ({ page }) => {
    await page.goto('/kho-viet-nam');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display delivery page', async ({ page }) => {
    await page.goto('/giao-hang');
    await page.waitForTimeout(3000);
    await expect(page.locator('main')).toBeVisible();
  });
});
