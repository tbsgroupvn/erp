import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .text-destructive, .error')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/don-hang');
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@tbslogistics.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    // Should navigate away from login
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/.*login.*/);
  });
});
