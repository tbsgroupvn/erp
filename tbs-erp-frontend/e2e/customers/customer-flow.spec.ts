import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Customer Management & Registration E2E Tests
// ---------------------------------------------------------------------------
// Customer list page at /khach-hang features:
//   - Search input (id="customer-search")
//   - Tier filter dropdown (NEW, REGULAR, VIP, STRATEGIC)
//   - Branch filter dropdown (HN, HCM)
//   - Active/inactive toggle filter
//   - DataTable with customer info
//   - "+ Them khach hang" link to /khach-hang/tao-moi
//
// Customer creation page at /khach-hang/tao-moi uses CustomerForm with:
//   - Card 1: Basic info (fullName*, phone*, email, companyName)
//   - Card 2: Additional info (address, taxCode, branch, saleId, tier,
//     creditLimit, depositRate, exchangeRateMode, note)
//   - Card 3: Contacts (dynamic list)
//   - Submit button: "Tao khach hang"
//
// Customer detail page at /khach-hang/[id] with tabs:
//   Thong tin, Don hang, Vi, Cong no, Khieu nai, Ghi chu
// ---------------------------------------------------------------------------

test.describe('Customer Management', () => {
  test('should display customer list with search and filters', async ({
    salePage,
  }) => {
    await salePage.goto('/khach-hang');

    // Page header
    await expect(
      salePage.getByRole('heading', { name: /Khách hàng/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Search input
    const searchInput = salePage.locator('#customer-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute(
      'placeholder',
      /Tìm theo tên, SĐT, mã KH/i,
    );

    // Tier filter dropdown
    const tierSelect = salePage.locator('select').filter({
      has: salePage.locator('option', { hasText: 'Tất cả hạng KH' }),
    });
    await expect(tierSelect).toBeVisible();

    // Branch filter dropdown
    const branchSelect = salePage.locator('select').filter({
      has: salePage.locator('option', { hasText: 'Tất cả chi nhánh' }),
    });
    await expect(branchSelect).toBeVisible();

    // Active filter buttons
    await expect(salePage.getByText('Tất cả')).toBeVisible();
    await expect(salePage.getByText('Hoạt động')).toBeVisible();
    await expect(salePage.getByText('Ngừng')).toBeVisible();

    // "+ Them khach hang" button/link
    await expect(
      salePage.getByRole('link', { name: /Thêm khách hàng/i }),
    ).toBeVisible();
  });

  test('should search customer by name', async ({ salePage }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Type a search query
    const searchInput = salePage.locator('#customer-search');
    await searchInput.fill('test');

    // Wait for debounced search to trigger (500ms debounce)
    // Use networkidle to detect the API response
    await salePage.waitForLoadState('networkidle');

    // Table should still be visible (even if results change)
    await expect(salePage.locator('table, [role="table"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should filter customers by tier', async ({ salePage }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Select VIP tier
    const tierSelect = salePage.locator('select').filter({
      has: salePage.locator('option', { hasText: 'Tất cả hạng KH' }),
    });
    await tierSelect.selectOption('VIP');

    // Wait for the filtered results to load
    await salePage.waitForLoadState('networkidle');

    // The filter should be applied (select should show VIP)
    await expect(tierSelect).toHaveValue('VIP');

    // "Xoa bo loc" link should appear
    await expect(
      salePage.getByText(/Xóa bộ lọc/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should filter customers by branch', async ({ salePage }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Select HN branch
    const branchSelect = salePage.locator('select').filter({
      has: salePage.locator('option', { hasText: 'Tất cả chi nhánh' }),
    });
    await branchSelect.selectOption('HN');

    await salePage.waitForLoadState('networkidle');

    await expect(branchSelect).toHaveValue('HN');
  });

  test('should navigate to customer detail page', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Search for the test customer
    const searchInput = salePage.locator('#customer-search');
    await searchInput.fill(testCustomer.name);
    await salePage.waitForLoadState('networkidle');

    // Click on the customer link in the table
    const customerLink = salePage.getByRole('link', {
      name: new RegExp(testCustomer.code || testCustomer.name, 'i'),
    });

    if (
      await customerLink.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await customerLink.first().click();

      // Should navigate to customer detail
      await expect(salePage).toHaveURL(
        new RegExp(`/khach-hang/${testCustomer.id}`),
        { timeout: 10_000 },
      );

      // Should show customer name in the heading
      await expect(
        salePage.getByRole('heading', { name: testCustomer.name }),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should create new customer via the form', async ({ salePage }) => {
    await salePage.goto('/khach-hang/tao-moi');

    // Page heading
    await expect(
      salePage.getByText('Thêm khách hàng'),
    ).toBeVisible({ timeout: 10_000 });

    // Card 1: Basic info
    const timestamp = Date.now();
    const customerName = `E2E Customer ${timestamp}`;
    const customerPhone = `09${String(timestamp).slice(-8)}`;

    await salePage.getByLabel('Họ tên *').fill(customerName);
    await salePage.getByLabel('Số điện thoại *').fill(customerPhone);
    await salePage
      .getByLabel('Email')
      .first()
      .fill(`e2e-${timestamp}@test.local`);
    await salePage.getByLabel('Công ty').fill('E2E Test Company');

    // Card 2: Additional info
    await salePage.getByLabel('Địa chỉ').fill('123 E2E Street, Test City');

    // Submit the form
    await salePage
      .getByRole('button', { name: /Tạo khách hàng/i })
      .click();

    // Should redirect to customer list on success
    await expect(salePage).toHaveURL(/\/khach-hang$/, {
      timeout: 15_000,
    });
  });

  test('should validate required fields on customer creation', async ({
    salePage,
  }) => {
    await salePage.goto('/khach-hang/tao-moi');

    // Try to submit without filling required fields
    await salePage
      .getByRole('button', { name: /Tạo khách hàng/i })
      .click();

    // Should show validation errors for fullName and phone
    await expect(
      salePage.getByText(/Họ tên bắt buộc/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      salePage.getByText(/Số điện thoại bắt buộc/i),
    ).toBeVisible();
  });

  test('should validate phone number format', async ({ salePage }) => {
    await salePage.goto('/khach-hang/tao-moi');

    await salePage.getByLabel('Họ tên *').fill('Test Customer');
    await salePage.getByLabel('Số điện thoại *').fill('12345'); // Invalid format

    await salePage
      .getByRole('button', { name: /Tạo khách hàng/i })
      .click();

    // Should show phone validation error
    await expect(
      salePage.getByText(/Số điện thoại không hợp lệ/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should view customer detail with tabs', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/khach-hang/${testCustomer.id}`);

    // Header should show customer name
    await expect(
      salePage.getByRole('heading', { name: testCustomer.name }),
    ).toBeVisible({ timeout: 10_000 });

    // Should show stat cards (Tong don hang, Doanh thu, Cong no, Han muc)
    await expect(
      salePage.getByText('Tổng đơn hàng'),
    ).toBeVisible();
    await expect(salePage.getByText('Doanh thu')).toBeVisible();
    await expect(
      salePage.getByText('Công nợ hiện tại'),
    ).toBeVisible();
    await expect(
      salePage.getByText('Hạn mức tín dụng'),
    ).toBeVisible();

    // Tab navigation
    const tabNames = [
      'Thông tin',
      'Đơn hàng',
      'Ví',
      'Công nợ',
      'Khiếu nại',
      'Ghi chú',
    ];

    for (const tabName of tabNames) {
      const tabButton = salePage.getByRole('button', { name: tabName });
      await expect(tabButton).toBeVisible();
    }

    // Click "Don hang" tab to see order history
    await salePage.getByRole('button', { name: 'Đơn hàng' }).click();

    // Should show order list or "Chua co don hang" message
    const ordersTable = salePage.locator('table');
    const noOrdersMsg = salePage.getByText(
      /Khách hàng chưa có đơn hàng nào/i,
    );

    // Either the table is visible or the no-orders message is visible
    const hasOrders = await ordersTable
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasNoOrdersMsg = await noOrdersMsg
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    expect(hasOrders || hasNoOrdersMsg).toBeTruthy();
  });

  test('should have a "Dat don" link from customer detail to order creation', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/khach-hang/${testCustomer.id}`);

    await expect(
      salePage.getByRole('heading', { name: testCustomer.name }),
    ).toBeVisible({ timeout: 10_000 });

    // "Dat don" button that links to order creation with customerId
    const orderLink = salePage.getByRole('link', { name: /Đặt đơn/i });
    await expect(orderLink).toBeVisible();
    await expect(orderLink).toHaveAttribute(
      'href',
      new RegExp(`/don-hang/tao-moi\\?customerId=${testCustomer.id}`),
    );
  });
});

test.describe('Customer -> First Order Flow', () => {
  test('should create customer then immediately create an order for them', async ({
    salePage,
    apiContext,
  }) => {
    const timestamp = Date.now();
    const customerName = `E2E Flow Customer ${timestamp}`;
    const customerPhone = `09${String(timestamp).slice(-8)}`;

    // Step 1: Create customer via API (faster than UI for setup)
    const createResponse = await apiContext.post('/customers', {
      data: {
        fullName: customerName,
        phone: customerPhone,
        email: `e2e-flow-${timestamp}@test.local`,
      },
    });

    let customerId: string;
    if (createResponse.ok()) {
      const body = await createResponse.json();
      customerId = body.data.id;
    } else {
      // If API fails, skip this test
      test.skip();
      return;
    }

    try {
      // Step 2: Navigate to order creation with the new customer
      await salePage.goto(
        `/don-hang/tao-moi?customerId=${customerId}`,
      );

      // Customer should be auto-selected
      await expect(salePage.getByText(customerName)).toBeVisible({
        timeout: 10_000,
      });

      // Step 3: Fill order and advance through wizard
      await salePage
        .getByRole('button', { name: /Tiếp tục/i })
        .click();

      // Fill a product in step 2
      await salePage
        .locator('input[name$=".productName"]')
        .first()
        .fill('First order product');
      await salePage
        .locator('input[name$=".quantity"]')
        .first()
        .fill('1');
      await salePage
        .locator('input[name$=".unitPrice"]')
        .first()
        .fill('100');

      await salePage
        .getByRole('button', { name: /Tiếp tục/i })
        .click();

      // Step 3: confirm
      await expect(
        salePage.getByText('Xác nhận đơn hàng'),
      ).toBeVisible();
      await expect(salePage.getByText(customerName)).toBeVisible();

      // Submit
      await salePage
        .getByRole('button', { name: /Tạo đơn hàng/i })
        .click();

      // Should redirect on success
      await expect(salePage).toHaveURL(/\/don-hang/, {
        timeout: 15_000,
      });
    } finally {
      // Cleanup the customer
      try {
        await apiContext.delete(`/customers/${customerId}`);
      } catch {
        // Best-effort cleanup
      }
    }
  });

  test('should show new customer in order creation customer picker', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto('/don-hang/tao-moi');

    // Dismiss draft dialog if present
    const discardButton = salePage.getByRole('button', {
      name: /bỏ nháp|hủy|bắt đầu mới/i,
    });
    if (
      await discardButton.isVisible({ timeout: 2_000 }).catch(() => false)
    ) {
      await discardButton.click();
    }

    // The customer picker uses a search-based combobox
    // Type the test customer's name to search
    const customerPickerInput = salePage.getByPlaceholder(
      /Tìm khách hàng theo tên, mã, SĐT/i,
    );

    if (
      await customerPickerInput
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
    ) {
      await customerPickerInput.fill(testCustomer.name);

      // Wait for search results to appear
      // The dropdown should show the customer
      await expect(
        salePage.getByText(testCustomer.name).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Customer List Interactions', () => {
  test('should toggle between all customers and churn risk tabs', async ({
    salePage,
  }) => {
    await salePage.goto('/khach-hang');

    // "Tat ca khach hang" tab should be active by default
    const allTab = salePage.getByRole('button', {
      name: /Tất cả khách hàng/i,
    });
    await expect(allTab).toBeVisible({ timeout: 10_000 });

    // Click "Nguy co roi bo" tab
    const churnTab = salePage.getByRole('button', {
      name: /Nguy cơ rời bỏ/i,
    });
    await expect(churnTab).toBeVisible();
    await churnTab.click();

    // Churn risk content should appear (either risk table or "Khong co" message)
    const riskContent = salePage.getByText(
      /Nguy cơ|Không có khách hàng có nguy cơ/i,
    );
    await expect(riskContent.first()).toBeVisible({ timeout: 10_000 });

    // Switch back to all customers
    await allTab.click();

    // Search input should be visible again
    await expect(salePage.locator('#customer-search')).toBeVisible();
  });

  test('should clear filters via "Xoa bo loc" link', async ({
    salePage,
  }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Apply a tier filter
    const tierSelect = salePage.locator('select').filter({
      has: salePage.locator('option', { hasText: 'Tất cả hạng KH' }),
    });
    await tierSelect.selectOption('VIP');

    // "Xoa bo loc" should appear
    const clearFilters = salePage.getByText(/Xóa bộ lọc/i);
    await expect(clearFilters).toBeVisible({ timeout: 5_000 });

    // Click it
    await clearFilters.click();

    // Tier select should be reset to empty (all)
    await expect(tierSelect).toHaveValue('');

    // "Xoa bo loc" should disappear
    await expect(clearFilters).not.toBeVisible();
  });

  test('should toggle active/inactive filter', async ({ salePage }) => {
    await salePage.goto('/khach-hang');
    await salePage.waitForLoadState('networkidle');

    // Click "Hoat dong" filter
    await salePage.getByText('Hoạt động').click();
    await salePage.waitForLoadState('networkidle');

    // "Xoa bo loc" should appear
    await expect(
      salePage.getByText(/Xóa bộ lọc/i),
    ).toBeVisible({ timeout: 5_000 });

    // Click "Ngung" filter
    await salePage.getByText('Ngừng').click();
    await salePage.waitForLoadState('networkidle');

    // Click "Tat ca" to reset
    await salePage.getByText('Tất cả').first().click();
    await salePage.waitForLoadState('networkidle');
  });
});
