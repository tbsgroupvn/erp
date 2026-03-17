import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Customer List page.
 *
 * Route: /khach-hang
 *
 * Two top-level tabs:
 *   - "Tat ca khach hang" (default) — search + filters + DataTable
 *   - "Nguy co roi bo" — churn risk list with bulk actions
 *
 * The "all" tab includes: search input (id="customer-search"), tier/branch selects,
 * active status toggle buttons, and a DataTable with customer data.
 *
 * The "churn" tab shows a table of HIGH/CRITICAL churn risk customers with
 * checkboxes for bulk selection and action buttons.
 */
export class CustomerListPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly createCustomerButton: Locator;

  // --- Tabs ---
  readonly tabAllCustomers: Locator;
  readonly tabChurnRisk: Locator;

  // --- Filters (all customers tab) ---
  readonly searchInput: Locator;
  readonly tierSelect: Locator;
  readonly branchSelect: Locator;
  readonly activeFilterAll: Locator;
  readonly activeFilterActive: Locator;
  readonly activeFilterInactive: Locator;
  readonly clearFiltersButton: Locator;

  // --- Table ---
  readonly dataTable: Locator;

  // --- Churn risk tab ---
  readonly churnBulkAssign: Locator;
  readonly churnBulkEmail: Locator;
  readonly churnBulkTask: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Khách hàng', level: 1 });
    this.createCustomerButton = page.getByRole('link', { name: /Thêm khách hàng/ });

    // Tab buttons rendered as styled <button> elements in a flex container
    this.tabAllCustomers = page.getByRole('button', { name: 'Tất cả khách hàng' });
    this.tabChurnRisk = page.getByRole('button', { name: /Nguy cơ rời bỏ/ });

    // Search input with explicit id
    this.searchInput = page.locator('#customer-search');
    // Tier filter select (first option "Tat ca hang KH")
    this.tierSelect = page.locator('select').filter({ hasText: /Tất cả hạng KH/ });
    // Branch filter select (first option "Tat ca chi nhanh")
    this.branchSelect = page.locator('select').filter({ hasText: /Tất cả chi nhánh/ });

    // Active status toggle buttons
    this.activeFilterAll = page.getByRole('button', { name: 'Tất cả', exact: true });
    this.activeFilterActive = page.getByRole('button', { name: 'Hoạt động' });
    this.activeFilterInactive = page.getByRole('button', { name: 'Ngừng' });
    this.clearFiltersButton = page.getByRole('button', { name: 'Xóa bộ lọc' });

    // DataTable component renders a table with role="table"
    this.dataTable = page.getByRole('table');

    // Churn risk bulk action buttons
    this.churnBulkAssign = page.getByRole('button', { name: /Giao cho Sale/ });
    this.churnBulkEmail = page.getByRole('button', { name: /Gửi email khuyến mãi/ });
    this.churnBulkTask = page.getByRole('button', { name: /Tạo task chăm sóc/ });
  }

  /** Navigate to the customer list page. */
  async goto() {
    await this.page.goto('/khach-hang');
  }

  /** Assert the page has loaded (heading visible, tab and table/search present). */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.tabAllCustomers).toBeVisible();
  }

  /** Type a search query into the customer search input. */
  async searchCustomer(query: string) {
    await this.searchInput.fill(query);
  }

  /**
   * Filter by customer tier using the select dropdown.
   * @param tier - Tier enum value: 'NEW', 'REGULAR', 'VIP', or 'STRATEGIC'
   */
  async filterByTier(tier: 'NEW' | 'REGULAR' | 'VIP' | 'STRATEGIC') {
    await this.tierSelect.selectOption(tier);
  }

  /**
   * Filter by branch using the select dropdown.
   * @param branch - 'HN' or 'HCM'
   */
  async filterByBranch(branch: 'HN' | 'HCM') {
    await this.branchSelect.selectOption(branch);
  }

  /** Filter to show only active customers. */
  async filterActive() {
    await this.activeFilterActive.click();
  }

  /** Filter to show only inactive customers. */
  async filterInactive() {
    await this.activeFilterInactive.click();
  }

  /** Clear all active filters. */
  async clearFilters() {
    await this.clearFiltersButton.click();
  }

  /**
   * Get a locator for a specific customer row by their code.
   * Customer codes are rendered as links in a font-mono td.
   */
  getCustomerRow(code: string): Locator {
    return this.dataTable.locator('tr').filter({ hasText: code });
  }

  /**
   * Click on a customer code link to navigate to their detail page.
   */
  async clickCustomerDetail(code: string) {
    await this.dataTable.getByRole('link', { name: code }).click();
    await expect(this.page).toHaveURL(/\/khach-hang\//);
  }

  /** Click the "Them khach hang" button to go to create page. */
  async clickCreateCustomer() {
    await this.createCustomerButton.click();
  }

  /** Get the count of visible rows in the DataTable (excluding header). */
  async getRowCount(): Promise<number> {
    return this.dataTable.locator('tbody tr').count();
  }

  /** Switch to the "Nguy co roi bo" (churn risk) tab. */
  async switchToChurnTab() {
    await this.tabChurnRisk.click();
    // Wait for churn tab content to appear
    await expect(
      this.churnBulkAssign.or(this.page.getByText('Không có khách hàng có nguy cơ rời bỏ cao')),
    ).toBeVisible();
  }

  /** Switch back to the "Tat ca khach hang" tab. */
  async switchToAllTab() {
    await this.tabAllCustomers.click();
  }

  /**
   * Select a customer in the churn risk tab by their customer code.
   * Clicks the checkbox (Square/CheckSquare icon) for that row.
   */
  async selectChurnCustomer(customerCode: string) {
    const row = this.page.locator('tr').filter({ hasText: customerCode });
    await row.locator('button').first().click();
  }

  /** Get the count of selected customers shown in the bulk action toolbar. */
  async getChurnSelectedCount(): Promise<string> {
    const text = await this.page.locator('text=/Đã chọn \\d+ khách hàng/').textContent();
    return text ?? '0';
  }
}
