import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Container page.
 *
 * Route: /container
 *
 * Two tabs (URL-driven via ?tab= query param):
 *   - "Container" (default) — container list with create form, filters, DataTable
 *   - "Theo doi" (tracking) — dynamically loaded tracking tab
 *
 * The Container tab has:
 *   - "Tao container" button that toggles a create form Card
 *   - "Goi y gom hang" button for consolidation suggestions
 *   - Status and route filter selects
 *   - DataTable with container rows + row actions (Chi tiet, status transitions, Them kien)
 */
export class ContainerPage {
  readonly page: Page;

  readonly heading: Locator;

  // --- Tabs ---
  readonly tabContainer: Locator;
  readonly tabTracking: Locator;

  // --- Action buttons ---
  readonly createButton: Locator;
  readonly consolidationButton: Locator;

  // --- Create form fields ---
  readonly createFormCard: Locator;
  readonly shippingRouteSelect: Locator;
  readonly originInput: Locator;
  readonly destinationInput: Locator;
  readonly carrierInput: Locator;
  readonly bookingRefInput: Locator;
  readonly vesselNameInput: Locator;
  readonly maxCapacityInput: Locator;
  readonly departureDateInput: Locator;
  readonly arrivalDateInput: Locator;
  readonly submitCreateButton: Locator;
  readonly cancelCreateButton: Locator;

  // --- Filters ---
  readonly statusFilter: Locator;
  readonly routeFilter: Locator;

  // --- DataTable ---
  readonly dataTable: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Container', level: 1 });

    // Tab buttons are rendered as border-b-2 styled buttons
    this.tabContainer = page.getByRole('button', { name: 'Container', exact: true });
    this.tabTracking = page.getByRole('button', { name: 'Theo dõi' });

    // Action buttons in the Container tab
    this.createButton = page.getByRole('button', { name: /Tao container|Đóng/ });
    this.consolidationButton = page.getByRole('button', { name: /Goi y gom hang|An goi y/ });

    // Create form inside a Card
    this.createFormCard = page.locator('[class*="CardHeader"]').filter({ hasText: 'Tạo container mới' }).locator('..');
    this.shippingRouteSelect = page.locator('#shippingRoute');
    this.originInput = page.locator('#origin');
    this.destinationInput = page.locator('#destination');
    this.carrierInput = page.locator('#carrier');
    this.bookingRefInput = page.locator('#bookingRef');
    this.vesselNameInput = page.locator('#vesselName');
    this.maxCapacityInput = page.locator('#maxCapacity');
    this.departureDateInput = page.locator('#estimatedDepartureAt');
    this.arrivalDateInput = page.locator('#estimatedArrivalAt');
    this.submitCreateButton = page.getByRole('button', { name: /Tạo container$|Đang tạo/ });
    this.cancelCreateButton = page.getByRole('button', { name: 'Hủy' });

    // Filter selects with explicit ids
    this.statusFilter = page.locator('#statusFilter');
    this.routeFilter = page.locator('#routeFilter');

    // DataTable
    this.dataTable = page.getByRole('table');
  }

  /** Navigate to the container page. */
  async goto() {
    await this.page.goto('/container');
  }

  /** Assert the page has loaded (heading visible). */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.tabContainer).toBeVisible();
  }

  /** Click the "Tao container" button to toggle the create form open. */
  async openCreateForm() {
    // Only click if the form is not already visible
    const isFormVisible = await this.shippingRouteSelect.isVisible().catch(() => false);
    if (!isFormVisible) {
      await this.createButton.click();
    }
    await expect(this.shippingRouteSelect).toBeVisible();
  }

  /**
   * Fill in the create container form fields.
   */
  async fillCreateForm(data: {
    route?: string;
    origin?: string;
    destination?: string;
    carrier?: string;
    bookingRef?: string;
    vesselName?: string;
    capacity?: number;
    departureDate?: string;
    arrivalDate?: string;
  }) {
    if (data.route) await this.shippingRouteSelect.selectOption(data.route);
    if (data.origin) await this.originInput.fill(data.origin);
    if (data.destination) await this.destinationInput.fill(data.destination);
    if (data.carrier) await this.carrierInput.fill(data.carrier);
    if (data.bookingRef) await this.bookingRefInput.fill(data.bookingRef);
    if (data.vesselName) await this.vesselNameInput.fill(data.vesselName);
    if (data.capacity !== undefined) await this.maxCapacityInput.fill(String(data.capacity));
    if (data.departureDate) await this.departureDateInput.fill(data.departureDate);
    if (data.arrivalDate) await this.arrivalDateInput.fill(data.arrivalDate);
  }

  /** Submit the create container form. */
  async submitCreate() {
    await this.submitCreateButton.click();
  }

  /** Close the create form without submitting. */
  async closeCreateForm() {
    await this.cancelCreateButton.click();
  }

  /**
   * Get a locator for a specific container row by its code.
   */
  getContainerRow(code: string): Locator {
    return this.dataTable.locator('tr').filter({ hasText: code });
  }

  /**
   * Click a status transition button for a container.
   * Row actions render Arrow + status label buttons.
   *
   * @param code - The container code
   * @param targetStatusLabel - The Vietnamese status label (e.g., "Dang xep", "Van chuyen")
   */
  async transitionStatus(code: string, targetStatusLabel: string) {
    const row = this.getContainerRow(code);
    await row.getByRole('button', { name: targetStatusLabel }).click();
  }

  /** Click "Chi tiet" on a container row to navigate to detail page. */
  async clickDetail(code: string) {
    const row = this.getContainerRow(code);
    await row.getByRole('button', { name: /Chi tiết/ }).click();
  }

  /** Click "Them kien" on a container row to toggle the add-packages form. */
  async clickAddPackages(code: string) {
    const row = this.getContainerRow(code);
    await row.getByRole('button', { name: /Thêm kiện/ }).click();
  }

  /** Switch to the "Theo doi" (tracking) tab. */
  async switchToTrackingTab() {
    await this.tabTracking.click();
    await expect(this.page).toHaveURL(/tab=tracking/);
  }

  /** Switch back to the "Container" (default) tab. */
  async switchToContainerTab() {
    await this.tabContainer.click();
  }

  /**
   * Filter containers by status.
   * @param status - Container status value (PLANNING, LOADING, IN_TRANSIT, etc.) or '' for all.
   */
  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  /**
   * Filter containers by shipping route.
   * @param route - ShippingRoute enum value or '' for all.
   */
  async filterByRoute(route: string) {
    await this.routeFilter.selectOption(route);
  }

  /** Get the count of visible rows in the DataTable. */
  async getRowCount(): Promise<number> {
    return this.dataTable.locator('tbody tr').count();
  }

  /** Toggle the consolidation suggestions panel. */
  async toggleConsolidation() {
    await this.consolidationButton.click();
  }
}
