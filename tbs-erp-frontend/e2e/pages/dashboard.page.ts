import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Dashboard (Tong quan) page.
 *
 * Route: /tong-quan
 *
 * Renders a PageHeader with title "Tong quan" and description "Xin chao, {fullName}".
 * Below the header, one of six role-specific dashboard components is rendered
 * based on getDashboardType(): executive, sales, finance, warehouse, hr, cskh.
 */
export class DashboardPage {
  readonly page: Page;

  /** Page heading rendered by PageHeader (h1). */
  readonly heading: Locator;

  /** Description text containing the greeting. */
  readonly description: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Tổng quan', level: 1 });
    this.description = page.locator('p.text-sm.text-muted-foreground').first();
  }

  /** Navigate to the dashboard page. */
  async goto() {
    await this.page.goto('/tong-quan');
  }

  /** Assert that the page has loaded (heading visible). */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  /** Assert that the greeting message contains the given name. */
  async expectGreeting(name: string) {
    await expect(this.description).toContainText(`Xin chào, ${name}`);
  }

  /**
   * Return a locator for all stat cards on the dashboard.
   * Stat cards use the Card component rendered inside each dashboard variant.
   */
  getStatCards(): Locator {
    return this.page.locator('[class*="rounded-xl border bg-card"]');
  }

  /**
   * Assert that the expected dashboard variant is loaded by checking
   * for content specific to each dashboard type.
   *
   * - 'executive': revenue overview content (BOD dashboard)
   * - 'sales': sales-specific content
   * - 'finance': AR/AP finance content
   * - 'warehouse': warehouse/package content
   * - 'hr': HR dashboard content
   * - 'cskh': CSKH/customer service content
   */
  async expectDashboardType(
    type: 'executive' | 'sales' | 'finance' | 'warehouse' | 'hr' | 'cskh',
  ) {
    // Each dashboard component renders distinctive text/elements.
    // We use data presence as a proxy since the components are code-split.
    const markers: Record<typeof type, string | RegExp> = {
      executive: /doanh thu|revenue/i,
      sales: /đơn hàng của tôi|mục tiêu|pipeline/i,
      finance: /công nợ|phải thu|phải trả|dòng tiền/i,
      warehouse: /kiện hàng|container|kho/i,
      hr: /nhân sự|chấm công|nghỉ phép/i,
      cskh: /khiếu nại|khách hàng|chăm sóc/i,
    };

    await expect(this.page.locator('body')).toContainText(markers[type]);
  }
}
