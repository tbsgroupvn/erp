import { test, expect } from '@playwright/test';
import { loginAsSale } from './helpers/auth';

test.describe('Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSale(page);
  });

  test('should display orders list', async ({ page }) => {
    await page.goto('/don-hang');
    await page.waitForTimeout(3000);
    // Should show a table or list of orders
    await expect(page.locator('table, [role="table"], .data-table')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to create order page', async ({ page }) => {
    await page.goto('/don-hang/tao-moi');
    await page.waitForTimeout(3000);
    // Should show order creation form
    await expect(page.locator('form, [data-testid="order-form"]')).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields on order creation', async ({ page }) => {
    await page.goto('/don-hang/tao-moi');
    await page.waitForTimeout(3000);
    // Try to submit without filling required fields
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      // Should show validation errors
      const errors = page.locator('.text-destructive, [role="alert"], .error, .field-error');
      await expect(errors.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
