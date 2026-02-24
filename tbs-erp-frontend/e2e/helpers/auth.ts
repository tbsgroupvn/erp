import { Page } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"], input[type="email"]', 'admin@tbslogistics.com');
  await page.fill('input[name="password"], input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

export async function loginAsSale(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"], input[type="email"]', 'sale01@tbslogistics.com');
  await page.fill('input[name="password"], input[type="password"]', 'Sale@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}
