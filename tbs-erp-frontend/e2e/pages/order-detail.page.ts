import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Order Detail page (360-view).
 *
 * Route: /don-hang/[id]
 *
 * Shows an OrderHeader (code as h1, overall status badge, "Tao don tuong tu" button).
 * Below: a Tabs component with 7 tabs:
 *   - Tong quan (overview) — default
 *   - Hang hoa (goods) — sub-order management with status transitions
 *   - Tai chinh (finance)
 *   - Van hanh (operations)
 *   - Du an (project)
 *   - Tai lieu (documents)
 *   - Nhat ky (audit)
 *
 * Each sub-order in the "Hang hoa" tab is a collapsible section.
 * Status transition buttons and cancel buttons are inside each sub-order panel.
 */
export class OrderDetailPage {
  readonly page: Page;

  // --- Header ---
  readonly orderCodeHeading: Locator;
  readonly statusBadge: Locator;
  readonly cloneOrderButton: Locator;
  readonly backToListLink: Locator;

  // --- Tab triggers ---
  readonly tabOverview: Locator;
  readonly tabGoods: Locator;
  readonly tabFinance: Locator;
  readonly tabOperations: Locator;
  readonly tabProject: Locator;
  readonly tabDocuments: Locator;
  readonly tabAudit: Locator;

  // --- Loading & Error states ---
  readonly loadingOverlay: Locator;
  readonly errorMessage: Locator;
  readonly notFoundMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // OrderHeader renders the order code as an h1
    this.orderCodeHeading = page.getByRole('heading', { level: 1 }).first();
    // Status badge is rendered next to the heading
    this.statusBadge = page.locator('.flex.items-center.gap-3 [class*="rounded-full"]').first();
    this.cloneOrderButton = page.getByRole('button', { name: /Tao don tuong tu/ });
    this.backToListLink = page.getByRole('link', { name: '' }).first();

    // Tab triggers rendered by shadcn/ui Tabs component
    this.tabOverview = page.getByRole('tab', { name: 'Tổng quan' });
    this.tabGoods = page.getByRole('tab', { name: 'Hàng hóa' });
    this.tabFinance = page.getByRole('tab', { name: 'Tài chính' });
    this.tabOperations = page.getByRole('tab', { name: 'Vận hành' });
    this.tabProject = page.getByRole('tab', { name: 'Dự án' });
    this.tabDocuments = page.getByRole('tab', { name: 'Tài liệu' });
    this.tabAudit = page.getByRole('tab', { name: 'Nhật ký' });

    this.loadingOverlay = page.locator('[class*="LoadingOverlay"]');
    this.errorMessage = page.getByText('Lỗi tải dữ liệu');
    this.notFoundMessage = page.getByText('Không tìm thấy đơn hàng');
  }

  /** Navigate to a specific order's detail page. */
  async goto(orderId: string) {
    await this.page.goto(`/don-hang/${orderId}`);
  }

  /** Assert the page has loaded (order code heading and tabs visible). */
  async expectLoaded() {
    await expect(this.orderCodeHeading).toBeVisible();
    await expect(this.tabOverview).toBeVisible();
  }

  /** Get the current order code from the heading. */
  async getOrderCode(): Promise<string> {
    return (await this.orderCodeHeading.textContent()) ?? '';
  }

  /** Get the current status text from the status badge. */
  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) ?? '';
  }

  /** Assert the order has a specific status label. */
  async expectStatus(statusLabel: string) {
    await expect(this.statusBadge).toContainText(statusLabel);
  }

  /**
   * Click a tab by its Vietnamese label.
   *
   * Valid tab names: "Tong quan", "Hang hoa", "Tai chinh",
   * "Van hanh", "Du an", "Tai lieu", "Nhat ky"
   */
  async clickTab(tabName: string) {
    await this.page.getByRole('tab', { name: tabName }).click();
  }

  /**
   * Get locators for all sub-order collapsible sections in the "Hang hoa" tab.
   * Each sub-order is a rounded-lg border bg-card container with a button toggle.
   */
  getSubOrders(): Locator {
    return this.page.locator('[class*="rounded-lg border bg-card"]').filter({
      has: this.page.locator('button:has-text("ORD-")'),
    });
  }

  /**
   * Expand a sub-order section by clicking its header.
   * @param subOrderCode - The sub-order code (e.g., "ORD-2026-00001-A")
   */
  async expandSubOrder(subOrderCode: string) {
    const section = this.page.locator('button').filter({ hasText: subOrderCode });
    await section.click();
  }

  /**
   * Click a status transition button for a specific sub-order.
   * The sub-order must first be expanded in the "Hang hoa" tab.
   *
   * @param targetStatusLabel - The Vietnamese label of the target status (e.g., "Bao gia")
   */
  async transitionStatus(targetStatusLabel: string) {
    const transitionButton = this.page.getByRole('button', { name: targetStatusLabel }).filter({
      has: this.page.locator('svg.lucide-arrow-right-circle'),
    });
    await transitionButton.click();

    // A confirm dialog appears — click "Xac nhan"
    await this.page.getByRole('button', { name: 'Xác nhận' }).click();
  }

  /**
   * Cancel a sub-order by clicking "Huy don" and filling in the reason.
   * The sub-order must first be expanded.
   *
   * @param reason - The cancellation reason text
   */
  async cancelOrder(reason: string) {
    // Click the "Huy don" button
    await this.page.getByRole('button', { name: /Hủy đơn/ }).click();

    // Fill the cancel reason textarea
    await this.page.getByPlaceholder('Nhập lý do hủy đơn...').fill(reason);

    // Confirm cancellation
    await this.page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  }

  /** Assert the cancel confirmation dialog is visible. */
  async expectCancelConfirmDialog() {
    await expect(this.page.getByText(/Xác nhận hủy đơn/)).toBeVisible();
    await expect(this.page.getByPlaceholder('Nhập lý do hủy đơn...')).toBeVisible();
  }

  /** Assert the status change confirmation dialog is visible. */
  async expectStatusChangeDialog() {
    await expect(this.page.getByText(/Xác nhận chuyển trạng thái/)).toBeVisible();
  }

  /** Assert the page shows an error state. */
  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }

  /** Assert the page shows a "not found" state. */
  async expectNotFound() {
    await expect(this.notFoundMessage).toBeVisible();
  }
}
