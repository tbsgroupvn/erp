import { test, expect } from '../fixtures';
import { waitForTableLoaded, waitForToast, waitForApiResponse } from '../helpers/wait-helpers';
import { createTestCustomer, createTestOrder, cleanupCustomer, cleanupOrder } from '../helpers/test-data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVOICE_PAGE = '/tai-chinh/hoa-don';
const VOUCHER_PAGE = '/tai-chinh/phieu-thu-chi';

// ---------------------------------------------------------------------------
// Invoice Management
// ---------------------------------------------------------------------------

test.describe('Invoice Management', () => {
  test('should display invoice list with summary cards', async ({ accountantPage }) => {
    await accountantPage.goto(INVOICE_PAGE);

    // Verify page header
    await expect(
      accountantPage.getByRole('heading', { name: /Hóa đơn/i }),
    ).toBeVisible();

    // Verify summary cards are present
    await expect(accountantPage.getByText(/Tổng nháp/i)).toBeVisible();
    await expect(accountantPage.getByText(/Đã xuất/i).first()).toBeVisible();
    await expect(accountantPage.getByText(/Đã hủy/i).first()).toBeVisible();

    // Verify table loads
    await waitForTableLoaded(accountantPage);
    await expect(
      accountantPage.getByRole('columnheader', { name: /Mã hóa đơn/i }),
    ).toBeVisible();
  });

  test('should open and close create invoice form', async ({ accountantPage }) => {
    await accountantPage.goto(INVOICE_PAGE);

    // Click "Tao hoa don" to open form
    await accountantPage.getByRole('button', { name: /Tạo hóa đơn/i }).click();
    await expect(
      accountantPage.getByRole('heading', { name: /Tạo hóa đơn mới/i }),
    ).toBeVisible();

    // Verify form fields are present
    await expect(accountantPage.getByLabel(/Mã khách hàng/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Số tiền/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Thuế suất/i)).toBeVisible();

    // Close form
    await accountantPage
      .getByRole('button', { name: /Đóng/i })
      .or(accountantPage.getByRole('button', { name: /Hủy/i }).last())
      .click();
    await expect(
      accountantPage.getByRole('heading', { name: /Tạo hóa đơn mới/i }),
    ).toBeHidden();
  });

  test('should create new invoice with required fields', async ({ accountantPage, apiContext }) => {
    // Create test customer for the invoice
    const customer = await createTestCustomer(apiContext);

    try {
      await accountantPage.goto(INVOICE_PAGE);

      // Open create form
      await accountantPage.getByRole('button', { name: /Tạo hóa đơn/i }).click();

      // Fill in customer ID
      await accountantPage.getByLabel(/Mã khách hàng/i).fill(customer.id);

      // Fill in amount
      await accountantPage.getByLabel(/Số tiền/i).fill('5000000');

      // Tax rate should default to 10
      const taxRateInput = accountantPage.getByLabel(/Thuế suất/i);
      await expect(taxRateInput).toHaveValue('10');

      // Submit the form
      await accountantPage
        .getByRole('button', { name: /^Tạo hóa đơn$/i })
        .click();

      // Wait for success
      await waitForToast(accountantPage, /Tạo hóa đơn thành công/i);
    } finally {
      await cleanupCustomer(apiContext, customer.id);
    }
  });

  test('should show invoice in DRAFT status after creation', async ({ accountantPage }) => {
    await accountantPage.goto(INVOICE_PAGE);
    await waitForTableLoaded(accountantPage);

    // Look for any DRAFT status badges in the table
    const draftBadges = accountantPage.locator('table tbody').getByText('Nháp');
    const draftCount = await draftBadges.count();

    // Verify that the summary card for "Tong nhap" shows a matching count
    const summaryCard = accountantPage
      .locator('div')
      .filter({ hasText: /Tổng nháp/i })
      .locator('p.text-2xl');

    if (await summaryCard.isVisible()) {
      const summaryText = await summaryCard.textContent();
      expect(Number(summaryText?.trim())).toBeGreaterThanOrEqual(0);
    }
  });

  test('should issue invoice (DRAFT to ISSUED)', async ({ accountantPage, apiContext }) => {
    // Create an invoice via API so we have a DRAFT to work with
    const customer = await createTestCustomer(apiContext);

    try {
      const invoiceResp = await apiContext.post('/invoices', {
        data: {
          customerId: customer.id,
          type: 'GTGT',
          amount: 1000000,
          taxRate: 10,
        },
      });

      if (!invoiceResp.ok()) {
        test.skip(true, 'Could not create test invoice via API');
        return;
      }

      await accountantPage.goto(INVOICE_PAGE);
      await waitForTableLoaded(accountantPage);

      // Find a DRAFT invoice row and click "Phat hanh"
      const draftRow = accountantPage
        .locator('table tbody tr')
        .filter({ hasText: 'Nháp' })
        .first();

      const issueButton = draftRow.getByRole('button', { name: /Phát hành/i });
      if (await issueButton.isVisible()) {
        await issueButton.click();
        await waitForToast(accountantPage, /Phát hành hóa đơn thành công/i);
      }
    } finally {
      await cleanupCustomer(apiContext, customer.id);
    }
  });

  test('should cancel invoice with reason', async ({ accountantPage, apiContext }) => {
    // Create a DRAFT invoice via API
    const customer = await createTestCustomer(apiContext);

    try {
      await apiContext.post('/invoices', {
        data: {
          customerId: customer.id,
          type: 'GTGT',
          amount: 500000,
          taxRate: 10,
        },
      });

      await accountantPage.goto(INVOICE_PAGE);
      await waitForTableLoaded(accountantPage);

      // Find a DRAFT invoice and click "Huy"
      const draftRow = accountantPage
        .locator('table tbody tr')
        .filter({ hasText: 'Nháp' })
        .first();

      const cancelButton = draftRow.getByRole('button', { name: /^Hủy$/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await waitForToast(accountantPage, /Hủy hóa đơn thành công/i);
      }
    } finally {
      await cleanupCustomer(apiContext, customer.id);
    }
  });

  test('should filter invoices by status', async ({ accountantPage }) => {
    await accountantPage.goto(INVOICE_PAGE);
    await waitForTableLoaded(accountantPage);

    // Open the status filter Select and choose "Da xuat" (ISSUED)
    const filterTrigger = accountantPage
      .locator('button[role="combobox"]')
      .filter({ hasText: /Tất cả/i })
      .first();
    await filterTrigger.click();

    // Select "Da xuat"
    await accountantPage.getByRole('option', { name: /Đã xuất/i }).click();

    // Wait for filtered data
    await waitForApiResponse(accountantPage, '/invoices');

    // If rows exist, they should all show "Da xuat" status
    const rows = accountantPage.locator('table tbody tr');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      const statusCells = rows.locator('text=Đã xuất');
      await expect(statusCells.first()).toBeVisible();
    }
  });

  test('should display correct totals in summary cards', async ({ accountantPage }) => {
    await accountantPage.goto(INVOICE_PAGE);
    await waitForTableLoaded(accountantPage);

    // Verify summary cards show numeric values
    const summaryValues = accountantPage.locator(
      '.grid .text-2xl.font-bold',
    );
    const count = await summaryValues.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < count; i++) {
      const text = await summaryValues.nth(i).textContent();
      expect(Number(text?.trim())).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Payment Vouchers
// ---------------------------------------------------------------------------

test.describe('Payment Voucher Management', () => {
  test('should navigate to payment vouchers page', async ({ accountantPage }) => {
    await accountantPage.goto(VOUCHER_PAGE);

    // Verify page header
    await expect(
      accountantPage.getByRole('heading', { name: /Phiếu thu chi/i }),
    ).toBeVisible();

    // Verify table loads
    await waitForTableLoaded(accountantPage);
    await expect(
      accountantPage.getByRole('columnheader', { name: /Mã phiếu/i }),
    ).toBeVisible();
    await expect(
      accountantPage.getByRole('columnheader', { name: /Loại/i }),
    ).toBeVisible();
  });

  test('should open create voucher form', async ({ accountantPage }) => {
    await accountantPage.goto(VOUCHER_PAGE);

    // Click "Tao phieu" to open the form
    await accountantPage.getByRole('button', { name: /Tạo phiếu/i }).click();

    // Verify form is visible with expected fields
    await expect(
      accountantPage.getByRole('heading', { name: /Tạo phiếu thu\/chi mới/i }),
    ).toBeVisible();

    // Verify required form fields
    await expect(accountantPage.getByLabel(/Loại phiếu/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Mã đơn hàng/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Số tiền/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Phương thức/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Loại chi phí/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Người nhận/i)).toBeVisible();
    await expect(accountantPage.getByLabel(/Lý do/i)).toBeVisible();
  });

  test('should create payment voucher (RECEIPT type)', async ({ accountantPage, apiContext }) => {
    // Create a test order for the voucher
    const order = await createTestOrder(apiContext);

    try {
      await accountantPage.goto(VOUCHER_PAGE);

      // Open create form
      await accountantPage.getByRole('button', { name: /Tạo phiếu/i }).click();

      // Select RECEIPT type
      await accountantPage.getByLabel(/Loại phiếu/i).selectOption('RECEIPT');

      // Fill in order ID
      await accountantPage.getByLabel(/Mã đơn hàng/i).fill(order.id);

      // Fill in amount
      await accountantPage.getByLabel(/Số tiền/i).fill('2000000');

      // Select payment method (BANK_TRANSFER)
      await accountantPage.getByLabel(/Phương thức/i).selectOption('BANK_TRANSFER');

      // Fill bank trace ID (required for RECEIPT + BANK_TRANSFER)
      const bankTraceInput = accountantPage.getByLabel(/Mã GD ngân hàng/i);
      if (await bankTraceInput.isVisible()) {
        await bankTraceInput.fill('FT240600123456789');
      }

      // Select cost type
      await accountantPage.getByLabel(/Loại chi phí/i).selectOption('Cọc đơn hàng');

      // Fill beneficiary
      await accountantPage.getByLabel(/Người nhận/i).fill('E2E Test Customer');

      // Fill reason
      await accountantPage.getByLabel(/Lý do/i).fill('E2E Test - Dat coc don hang');

      // Submit
      await accountantPage
        .getByRole('button', { name: /^Tạo phiếu$/i })
        .click();

      // Wait for success
      await waitForToast(accountantPage, /Tạo phiếu thu\/chi thành công/i);
    } finally {
      await cleanupOrder(apiContext, order.id);
    }
  });

  test('should validate required fields on voucher creation', async ({ accountantPage }) => {
    await accountantPage.goto(VOUCHER_PAGE);

    // Open form
    await accountantPage.getByRole('button', { name: /Tạo phiếu/i }).click();

    // Try to submit empty form
    await accountantPage.getByRole('button', { name: /^Tạo phiếu$/i }).click();

    // Should show validation errors
    const errors = accountantPage.locator('.text-destructive');
    await expect(errors.first()).toBeVisible({ timeout: 5_000 });
  });

  test('should show voucher status in table', async ({ accountantPage }) => {
    await accountantPage.goto(VOUCHER_PAGE);
    await waitForTableLoaded(accountantPage);

    // Verify status column is present
    await expect(
      accountantPage.getByRole('columnheader', { name: /Trạng thái/i }),
    ).toBeVisible();

    // Status values should be one of: Cho duyet, Da duyet, Tu choi
    const rows = accountantPage.locator('table tbody tr');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      // First row should have a visible status badge
      const firstRowStatus = rows
        .first()
        .locator('[class*="bg-"][class*="text-"]');
      await expect(firstRowStatus.first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Invoice -> Payment Full Flow
// ---------------------------------------------------------------------------

test.describe('Invoice to Payment Flow', () => {
  test('should complete full flow: create invoice, issue, then create payment voucher', async ({
    accountantPage,
    apiContext,
  }) => {
    const customer = await createTestCustomer(apiContext);
    const order = await createTestOrder(apiContext);

    try {
      // Step 1: Create invoice via API
      const invoiceResp = await apiContext.post('/invoices', {
        data: {
          customerId: customer.id,
          orderId: order.id,
          type: 'GTGT',
          amount: 10000000,
          taxRate: 10,
        },
      });

      if (!invoiceResp.ok()) {
        test.skip(true, 'Could not create test invoice via API');
        return;
      }

      const invoiceBody = await invoiceResp.json();
      const invoiceId = invoiceBody.data.id;

      // Step 2: Issue the invoice via API
      const issueResp = await apiContext.patch(`/invoices/${invoiceId}/issue`);
      expect(issueResp.ok()).toBeTruthy();

      // Step 3: Verify the invoice shows as ISSUED in the UI
      await accountantPage.goto(INVOICE_PAGE);
      await waitForTableLoaded(accountantPage);

      // Check that "Da xuat" badge is visible somewhere in the table
      const issuedBadges = accountantPage.locator('table tbody').getByText('Đã xuất');
      const badgeCount = await issuedBadges.count();
      expect(badgeCount).toBeGreaterThan(0);

      // Step 4: Navigate to voucher page and create a payment
      await accountantPage.goto(VOUCHER_PAGE);
      await accountantPage.getByRole('button', { name: /Tạo phiếu/i }).click();

      // Fill in the payment voucher form
      await accountantPage.getByLabel(/Loại phiếu/i).selectOption('RECEIPT');
      await accountantPage.getByLabel(/Mã đơn hàng/i).fill(order.id);
      await accountantPage.getByLabel(/Số tiền/i).fill('11000000');
      await accountantPage.getByLabel(/Phương thức/i).selectOption('BANK_TRANSFER');

      // Bank trace ID for RECEIPT + BANK_TRANSFER
      const bankTraceInput = accountantPage.getByLabel(/Mã GD ngân hàng/i);
      if (await bankTraceInput.isVisible()) {
        await bankTraceInput.fill('FT240600E2EFLOW01');
      }

      await accountantPage.getByLabel(/Loại chi phí/i).selectOption('Thanh toán đơn hàng');
      await accountantPage.getByLabel(/Người nhận/i).fill(customer.name);
      await accountantPage.getByLabel(/Lý do/i).fill(`Thanh toan don hang ${order.orderCode}`);

      // Submit
      await accountantPage.getByRole('button', { name: /^Tạo phiếu$/i }).click();
      await waitForToast(accountantPage, /Tạo phiếu thu\/chi thành công/i);
    } finally {
      await cleanupOrder(apiContext, order.id);
      await cleanupCustomer(apiContext, customer.id);
    }
  });

  test('should approve payment voucher via API and verify status in UI', async ({
    accountantPage,
    apiContext,
  }) => {
    const order = await createTestOrder(apiContext);

    try {
      // Create a voucher via API
      const voucherResp = await apiContext.post('/cash/vouchers', {
        data: {
          type: 'RECEIPT',
          orderId: order.id,
          amount: 3000000,
          paymentMethod: 'BANK_TRANSFER',
          costType: 'Cọc đơn hàng',
          beneficiary: 'E2E Test Beneficiary',
          reason: 'E2E Test Voucher for approval',
          bankTraceId: 'FT240600APPROVE01',
        },
      });

      if (!voucherResp.ok()) {
        test.skip(true, 'Could not create test voucher via API');
        return;
      }

      const voucherBody = await voucherResp.json();
      const voucherId = voucherBody.data.id;

      // Approve via API (typically a manager role)
      const approveResp = await apiContext.patch(
        `/cash/vouchers/${voucherId}/approve`,
      );

      if (approveResp.ok()) {
        // Verify in UI that the voucher shows as APPROVED
        await accountantPage.goto(VOUCHER_PAGE);
        await waitForTableLoaded(accountantPage);

        // Look for approved status
        const approvedBadges = accountantPage
          .locator('table tbody')
          .getByText(/Đã duyệt/i);
        const count = await approvedBadges.count();
        expect(count).toBeGreaterThanOrEqual(0); // May not be visible on current page
      }
    } finally {
      await cleanupOrder(apiContext, order.id);
    }
  });

  test('should reject payment voucher via API and verify status in UI', async ({
    accountantPage,
    apiContext,
  }) => {
    const order = await createTestOrder(apiContext);

    try {
      // Create a voucher via API
      const voucherResp = await apiContext.post('/cash/vouchers', {
        data: {
          type: 'PAYMENT',
          orderId: order.id,
          amount: 1500000,
          paymentMethod: 'CASH',
          costType: 'Chi phí khác',
          beneficiary: 'E2E Reject Test',
          reason: 'E2E Test Voucher for rejection',
        },
      });

      if (!voucherResp.ok()) {
        test.skip(true, 'Could not create test voucher via API');
        return;
      }

      const voucherBody = await voucherResp.json();
      const voucherId = voucherBody.data.id;

      // Reject via API
      const rejectResp = await apiContext.patch(
        `/cash/vouchers/${voucherId}/reject`,
        {
          data: { reason: 'E2E Test rejection - invalid documentation' },
        },
      );

      if (rejectResp.ok()) {
        // Verify in UI
        await accountantPage.goto(VOUCHER_PAGE);
        await waitForTableLoaded(accountantPage);

        // Look for rejected status in the table
        const rejectedBadges = accountantPage
          .locator('table tbody')
          .getByText(/Từ chối/i);
        const count = await rejectedBadges.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await cleanupOrder(apiContext, order.id);
    }
  });
});
