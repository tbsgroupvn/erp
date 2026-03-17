import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Order List page.
 *
 * Route: /don-hang
 *
 * Renders a PageHeader "Don hang" with two action buttons: "Nhap Excel" and "Tao don hang".
 * Below the header: OrderFilters component with status tabs, search input, branch/sale/date filters.
 * A tanstack react-table renders master orders with expandable sub-order rows.
 * Pagination shows "Trang X / Y" with prev/next chevron buttons.
 */
export class OrderListPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly createOrderButton: Locator;
  readonly importExcelButton: Locator;

  // --- Filters ---
  readonly searchInput: Locator;
  readonly branchSelect: Locator;

  // --- Table ---
  readonly table: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyState: Locator;

  // --- Pagination ---
  readonly paginationInfo: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Đơn hàng', level: 1 });
    this.createOrderButton = page.getByRole('link', { name: /Tạo đơn hàng/ });
    this.importExcelButton = page.getByRole('link', { name: /Nhập Excel/ });

    // OrderFilters renders a search input with placeholder
    this.searchInput = page.getByPlaceholder('Tìm theo mã đơn, khách hàng...');
    // Branch filter is a <select> rendered inside OrderFilters
    this.branchSelect = page.locator('select').filter({ hasText: /Chi nhánh/ });

    this.table = page.locator('table').first();
    this.loadingIndicator = page.getByText('Đang tải dữ liệu...');
    this.emptyState = page.getByText('Không có dữ liệu');

    this.paginationInfo = page.locator('text=/Trang \\d+ \\/ \\d+/');
    this.prevPageButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
    this.nextPageButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
  }

  /** Navigate to the order list page. */
  async goto() {
    await this.page.goto('/don-hang');
  }

  /** Assert the page has loaded (heading and table are visible). */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    // Wait for either the table to have rows or the empty state
    await expect(
      this.table.or(this.emptyState),
    ).toBeVisible();
  }

  /** Click the "Tao don hang" button, navigating to the create order page. */
  async clickCreateOrder() {
    await this.createOrderButton.click();
    await expect(this.page).toHaveURL(/\/don-hang\/tao-moi/);
  }

  /** Type a search query into the order search input. */
  async searchOrder(query: string) {
    await this.searchInput.fill(query);
  }

  /**
   * Click a status filter tab.
   * Available statuses: "Tat ca", "Dang xu ly", "Hoan thanh", "Da huy".
   */
  async filterByStatus(statusLabel: string) {
    await this.page
      .locator('div.flex.gap-1.overflow-x-auto')
      .getByRole('button', { name: statusLabel })
      .click();
  }

  /**
   * Get a locator for a specific order row by its master order code.
   * The code is rendered as a font-medium span inside a table row.
   */
  getOrderRow(orderCode: string): Locator {
    return this.table.locator('tr').filter({ hasText: orderCode });
  }

  /**
   * Click on an order row to navigate to its detail page.
   * The order code is a link inside the master order columns.
   */
  async clickOrderDetail(orderCode: string) {
    await this.getOrderRow(orderCode).getByRole('link', { name: orderCode }).click();
  }

  /** Get the count of visible data rows in the table (excluding header and loading). */
  async getRowCount(): Promise<number> {
    return this.table.locator('tbody tr').count();
  }

  /** Go to the next page in pagination. */
  async goToNextPage() {
    await this.nextPageButton.click();
  }

  /** Go to the previous page in pagination. */
  async goToPrevPage() {
    await this.prevPageButton.click();
  }
}
