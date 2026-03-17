import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Create Order page (3-step wizard).
 *
 * Route: /don-hang/tao-moi
 *
 * The wizard has 3 steps controlled by a StepIndicator component:
 *   Step 0: "Thong tin chung"  - customer picker, branch select, note
 *   Step 1: "Don con"          - sub-orders with service type, items
 *   Step 2: "Xac nhan"         - review summary + final submit
 *
 * Steps are rendered conditionally (only one visible at a time).
 * A "Che do nhap nhanh" checkbox toggles quick mode.
 * Draft auto-save may show a DraftDialog on mount.
 */
export class OrderCreatePage {
  readonly page: Page;

  readonly heading: Locator;
  readonly backButton: Locator;

  // --- Step indicator ---
  readonly stepIndicator: Locator;

  // --- Step 1: General Info ---
  readonly customerPicker: Locator;
  readonly branchSelect: Locator;
  readonly noteTextarea: Locator;
  readonly nextButtonStep1: Locator;

  // --- Step 2: Sub Orders ---
  readonly addSubOrderButton: Locator;
  readonly nextButtonStep2: Locator;
  readonly backButtonStep2: Locator;

  // --- Step 3: Confirmation ---
  readonly confirmationHeading: Locator;
  readonly submitButton: Locator;
  readonly backButtonStep3: Locator;

  // --- Quick mode ---
  readonly quickModeCheckbox: Locator;

  // --- Draft dialog ---
  readonly draftDialog: Locator;

  // --- Sale code warning ---
  readonly saleCodeWarning: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Tạo đơn hàng mới' });
    this.backButton = page.locator('a[href="/don-hang"]').first();

    this.stepIndicator = page.locator('[class*="step"]').first();

    // Step 1 elements
    // The CustomerPicker component uses a search input with a specific placeholder
    this.customerPicker = page.getByPlaceholder('Tìm khách hàng theo tên, mã, SĐT...');
    this.branchSelect = page.locator('select[name="branch"]');
    this.noteTextarea = page.getByPlaceholder('Ghi chú cho đơn tổng...');
    this.nextButtonStep1 = page.getByRole('button', { name: 'Tiếp tục' });

    // Step 2 elements - "Them don con" button is rendered in SubOrdersStep
    this.addSubOrderButton = page.getByRole('button', { name: /Thêm đơn con/ });
    this.nextButtonStep2 = page.getByRole('button', { name: 'Tiếp tục' });
    this.backButtonStep2 = page.getByRole('button', { name: 'Quay lại' });

    // Step 3 elements
    this.confirmationHeading = page.getByRole('heading', { name: 'Xác nhận đơn hàng' });
    this.submitButton = page.getByRole('button', { name: /Tạo đơn hàng/ });
    this.backButtonStep3 = page.getByRole('button', { name: 'Quay lại' });

    this.quickModeCheckbox = page.getByLabel('Chế độ nhập nhanh');

    // Draft restore dialog
    this.draftDialog = page.locator('[class*="DraftDialog"], [role="dialog"]').first();

    this.saleCodeWarning = page.getByText('Giới hạn Quyền tạo đơn hàng');
  }

  /** Navigate to the create order page. */
  async goto() {
    await this.page.goto('/don-hang/tao-moi');
  }

  /** Assert the page has loaded (heading visible, step 1 shown). */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  /**
   * Search and select a customer in the CustomerPicker.
   * Types the name into the picker, waits for dropdown results, and clicks the first match.
   */
  async fillCustomer(name: string) {
    await this.customerPicker.fill(name);
    // Wait for the dropdown to populate, then click the first option
    const option = this.page.locator('[class*="customer-picker"] [class*="option"], [role="option"]').first();
    await option.waitFor({ state: 'visible' });
    await option.click();
  }

  /**
   * Select a branch from the branch dropdown.
   * @param branch - The branch enum value (e.g., 'HN' or 'HCM').
   */
  async selectBranch(branch: 'HN' | 'HCM') {
    await this.branchSelect.selectOption(branch);
  }

  /** Fill the optional note field in step 1. */
  async fillNote(note: string) {
    await this.noteTextarea.fill(note);
  }

  /** Click "Tiep tuc" to advance from Step 1 to Step 2. */
  async goToStep2() {
    await this.nextButtonStep1.click();
    // Wait for sub-order elements to appear
    await expect(this.addSubOrderButton.or(this.page.locator('select[name*="serviceType"]').first())).toBeVisible();
  }

  /**
   * Add a sub-order with a service type and product items.
   * If multiple sub-orders are needed, call this method multiple times.
   *
   * @param serviceType - The service type enum value (VCT, MHH, UTXNK, LCLCN)
   * @param items - Array of product items to add
   */
  async addSubOrder(
    serviceType: string,
    items: Array<{ name: string; qty: number; price: number }>,
  ) {
    // Select service type on the currently active sub-order
    const serviceSelect = this.page.locator('select[name*="serviceType"]').last();
    await serviceSelect.selectOption(serviceType);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // If not the first item, click "Them san pham" to add a new row
      if (i > 0) {
        await this.page.getByRole('button', { name: /Thêm sản phẩm/ }).click();
      }

      // Fill product fields for this item row
      const productInputs = this.page.locator('input[name*="productName"]');
      const qtyInputs = this.page.locator('input[name*="quantity"]');
      const priceInputs = this.page.locator('input[name*="unitPrice"]');

      await productInputs.last().fill(item.name);
      await qtyInputs.last().fill(String(item.qty));
      await priceInputs.last().fill(String(item.price));
    }
  }

  /** Click "Tiep tuc" to advance from Step 2 to Step 3. */
  async goToStep3() {
    await this.nextButtonStep2.click();
    await expect(this.confirmationHeading).toBeVisible();
  }

  /** Click the final "Tao don hang" submit button on Step 3. */
  async submitOrder() {
    await this.submitButton.click();
  }

  /**
   * Assert that order creation succeeded.
   * On success, the page redirects to /don-hang and a success toast appears.
   */
  async expectOrderCreated() {
    await expect(this.page).toHaveURL(/\/don-hang$/);
    await expect(this.page.getByText(/Tạo đơn hàng thành công/)).toBeVisible();
  }

  /** Toggle quick mode on or off. */
  async toggleQuickMode() {
    await this.quickModeCheckbox.click();
  }

  /** Dismiss the draft restore dialog by discarding the draft. */
  async discardDraft() {
    const discardButton = this.page.getByRole('button', { name: /Bỏ qua|Xóa nháp/ });
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
  }

  /** Restore a saved draft from the draft dialog. */
  async restoreDraft() {
    const restoreButton = this.page.getByRole('button', { name: /Khôi phục|Tải lại/ });
    if (await restoreButton.isVisible()) {
      await restoreButton.click();
    }
  }

  /** Assert that the user sees the "no sale code" warning. */
  async expectNoSaleCodeWarning() {
    await expect(this.saleCodeWarning).toBeVisible();
  }
}
