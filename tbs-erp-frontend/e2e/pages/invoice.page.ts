import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Invoice page.
 *
 * Route: /tai-chinh/hoa-don
 *
 * PageHeader: "Hoa don" with a toggle button "Tao hoa don" / "Dong".
 * Summary cards: 3 cards showing counts for "Tong nhap", "Da xuat", "Da huy".
 * Create invoice form (toggleable Card) with fields:
 *   customerId, orderId, type (Select), amount, taxRate.
 * Status filter: shadcn/ui Select with options ALL, DRAFT, ISSUED, SENT_TAX, CANCELLED, ADJUSTED.
 * DataTable: code, customerId, type, totalAmount, status, createdAt, actions.
 * Row actions: "Phat hanh" button (for DRAFT), "Huy" button (for DRAFT/ISSUED).
 */
export class InvoicePage {
  readonly page: Page;

  readonly heading: Locator;
  readonly toggleFormButton: Locator;

  // --- Summary cards ---
  readonly draftCountCard: Locator;
  readonly issuedCountCard: Locator;
  readonly cancelledCountCard: Locator;

  // --- Create form ---
  readonly customerIdInput: Locator;
  readonly orderIdInput: Locator;
  readonly typeSelect: Locator;
  readonly amountInput: Locator;
  readonly taxRateInput: Locator;
  readonly submitButton: Locator;
  readonly cancelFormButton: Locator;

  // --- Status filter ---
  readonly statusFilter: Locator;

  // --- DataTable ---
  readonly dataTable: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Hóa đơn', level: 1 });
    this.toggleFormButton = page.getByRole('button', { name: /Tạo hóa đơn|Đóng/ }).first();

    // Summary cards: each Card has a CardTitle with the label and a <p> with the count
    this.draftCountCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Tổng nháp' });
    this.issuedCountCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Đã xuất' });
    this.cancelledCountCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Đã hủy' });

    // Create form fields (inside the toggle Card)
    this.customerIdInput = page.locator('#customerId');
    this.orderIdInput = page.locator('#orderId');
    // The type select uses shadcn Select component, not a native <select>
    this.typeSelect = page.locator('[class*="SelectTrigger"]').first();
    this.amountInput = page.locator('#amount');
    this.taxRateInput = page.locator('#taxRate');
    this.submitButton = page.getByRole('button', { name: /Tạo hóa đơn$|Đang tạo/ });
    this.cancelFormButton = page.getByRole('button', { name: 'Hủy', exact: true });

    // Status filter: shadcn Select with trigger text "Tat ca"
    this.statusFilter = page.getByText('Lọc trạng thái:').locator('..').locator('[class*="SelectTrigger"]');

    // DataTable
    this.dataTable = page.getByRole('table');
  }

  /** Navigate to the invoice page. */
  async goto() {
    await this.page.goto('/tai-chinh/hoa-don');
  }

  /** Assert the page has loaded. */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.draftCountCard).toBeVisible();
  }

  /** Toggle the create invoice form open (click "Tao hoa don"). */
  async openCreateForm() {
    const isFormVisible = await this.customerIdInput.isVisible().catch(() => false);
    if (!isFormVisible) {
      await this.toggleFormButton.click();
    }
    await expect(this.customerIdInput).toBeVisible();
  }

  /** Close the create invoice form. */
  async closeCreateForm() {
    await this.cancelFormButton.click();
  }

  /**
   * Fill in the create invoice form.
   */
  async fillInvoice(data: {
    customerId: string;
    orderId?: string;
    type?: 'GTGT' | 'DIEU_CHINH' | 'HUY';
    amount: number;
    taxRate?: number;
  }) {
    await this.customerIdInput.fill(data.customerId);
    if (data.orderId) await this.orderIdInput.fill(data.orderId);
    if (data.type) {
      // Click the shadcn Select trigger, then select the option
      await this.typeSelect.click();
      const typeLabels: Record<string, string> = {
        GTGT: 'GTGT',
        DIEU_CHINH: 'Điều chỉnh',
        HUY: 'Hủy',
      };
      await this.page.getByRole('option', { name: typeLabels[data.type] }).click();
    }
    await this.amountInput.fill(String(data.amount));
    if (data.taxRate !== undefined) {
      await this.taxRateInput.clear();
      await this.taxRateInput.fill(String(data.taxRate));
    }
  }

  /** Submit the create invoice form. */
  async submitInvoice() {
    await this.submitButton.click();
  }

  /**
   * Get a locator for a specific invoice row by its code.
   */
  getInvoiceRow(code: string): Locator {
    return this.dataTable.locator('tr').filter({ hasText: code });
  }

  /**
   * Click "Phat hanh" (issue) for a DRAFT invoice.
   * @param code - The invoice code
   */
  async issueInvoice(code: string) {
    const row = this.getInvoiceRow(code);
    await row.getByRole('button', { name: 'Phát hành' }).click();
  }

  /**
   * Click "Huy" (cancel) for a DRAFT or ISSUED invoice.
   * @param code - The invoice code
   */
  async cancelInvoice(code: string) {
    const row = this.getInvoiceRow(code);
    await row.getByRole('button', { name: 'Hủy' }).click();
  }

  /**
   * Get the count displayed in a summary card.
   * @param status - 'draft', 'issued', or 'cancelled'
   */
  async getStatusCount(status: 'draft' | 'issued' | 'cancelled'): Promise<number> {
    const cardMap = {
      draft: this.draftCountCard,
      issued: this.issuedCountCard,
      cancelled: this.cancelledCountCard,
    };
    const card = cardMap[status];
    const countText = await card.locator('p.text-2xl').textContent();
    return parseInt(countText ?? '0', 10);
  }

  /**
   * Filter invoices by status using the shadcn Select.
   * @param statusLabel - The Vietnamese label (e.g., "Nhap", "Da xuat", "Tat ca")
   */
  async filterByStatus(statusLabel: string) {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: statusLabel }).click();
  }

  /** Get the count of visible rows in the DataTable. */
  async getRowCount(): Promise<number> {
    return this.dataTable.locator('tbody tr').count();
  }
}
