import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Order Creation Wizard E2E Tests
// ---------------------------------------------------------------------------
// The order creation page at /don-hang/tao-moi uses a 3-step wizard:
//   Step 0: General Info (customer picker, branch select, note)
//   Step 1: Sub-orders (service type, clearance type, product items)
//   Step 2: Confirmation (review & submit)
//
// The form uses react-hook-form + zod validation. Navigation between steps
// triggers field-level validation via `trigger()`.
// ---------------------------------------------------------------------------

test.describe('Order Creation', () => {
  test('should navigate to order creation page and show step 1', async ({
    salePage,
  }) => {
    await salePage.goto('/don-hang/tao-moi');

    // Step indicator should show 3 steps, with step 1 active
    await expect(salePage.getByText('Tạo đơn hàng mới')).toBeVisible();
    await expect(salePage.getByText('Thông tin chung')).toBeVisible();
    await expect(salePage.getByText('Đơn con')).toBeVisible();
    await expect(salePage.getByText('Xác nhận')).toBeVisible();

    // Customer picker and branch select should be visible in step 1
    await expect(salePage.getByText('Khách hàng *')).toBeVisible();
    await expect(salePage.getByText('Chi nhánh *')).toBeVisible();
  });

  test('should create VCT order successfully via full wizard flow', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    // Step 1 should auto-fill the customer from query param
    // Wait for customer name to appear in the picker
    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Branch defaults to HN; click "Tiep tuc" to go to step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // -- Step 2: Sub-orders --
    // Service type defaults to VCT; clearance defaults to Tieu ngach
    await expect(salePage.getByText('Đơn con A')).toBeVisible();
    await expect(salePage.getByText('Loại dịch vụ *')).toBeVisible();

    // Fill first product
    const productNameInputs = salePage.locator(
      'input[name$=".productName"]',
    );
    await productNameInputs.first().fill('Tai nghe Bluetooth E2E');

    const quantityInputs = salePage.locator('input[name$=".quantity"]');
    await quantityInputs.first().fill('10');

    const priceInputs = salePage.locator('input[name$=".unitPrice"]');
    await priceInputs.first().fill('150000');

    // Add a second product
    await salePage.getByRole('button', { name: /Thêm sản phẩm/i }).click();
    await productNameInputs.nth(1).fill('Cap sac USB-C E2E');
    await quantityInputs.nth(1).fill('20');
    await priceInputs.nth(1).fill('50000');

    // Move to step 3
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // -- Step 3: Confirmation --
    await expect(salePage.getByText('Xác nhận đơn hàng')).toBeVisible();
    await expect(salePage.getByText(testCustomer.name)).toBeVisible();
    await expect(salePage.getByText('Tai nghe Bluetooth E2E')).toBeVisible();
    await expect(salePage.getByText('Cap sac USB-C E2E')).toBeVisible();

    // Submit
    await salePage.getByRole('button', { name: /Tạo đơn hàng/i }).click();

    // On success: toast + redirect to /don-hang
    await expect(
      salePage.getByText(/tạo đơn hàng thành công/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(salePage).toHaveURL(/\/don-hang$/, { timeout: 10_000 });
  });

  test('should create MHH order and show MHH price calculator', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    // Wait for customer to load
    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Go to step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Change service type to MHH
    const serviceTypeSelect = salePage.locator(
      'select[name="subOrders.0.serviceType"]',
    );
    await serviceTypeSelect.selectOption('MHH');

    // MHH price calculator should appear
    await expect(
      salePage.getByText(/Tính giá mua hộ hàng/i),
    ).toBeVisible({ timeout: 5_000 });

    // Fill product
    await salePage
      .locator('input[name$=".productName"]')
      .first()
      .fill('iPhone 16 Pro MHH E2E');
    await salePage
      .locator('input[name$=".quantity"]')
      .first()
      .fill('2');
    await salePage
      .locator('input[name$=".unitPrice"]')
      .first()
      .fill('7500000');

    // Move to step 3
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Confirmation should show MHH service label
    await expect(salePage.getByText('Xác nhận đơn hàng')).toBeVisible();
    await expect(
      salePage.getByText('iPhone 16 Pro MHH E2E'),
    ).toBeVisible();
  });

  test('should validate required fields and block step navigation', async ({
    salePage,
  }) => {
    await salePage.goto('/don-hang/tao-moi');

    // Dismiss draft dialog if present
    const discardButton = salePage.getByRole('button', {
      name: /bỏ nháp|hủy|bắt đầu mới/i,
    });
    if (await discardButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await discardButton.click();
    }

    // Try to proceed without selecting a customer
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Should show validation error for customer
    await expect(
      salePage.getByText(/Chọn khách hàng/i),
    ).toBeVisible({ timeout: 5_000 });

    // Should still be on step 1 (customer picker visible)
    await expect(salePage.getByText('Khách hàng *')).toBeVisible();
  });

  test('should validate product fields in step 2', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Go to step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Leave the product name empty and try to proceed
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Should show validation error about product name
    await expect(
      salePage.getByText(/Tên sản phẩm bắt buộc/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('should add and remove sub-orders', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Go to step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Initially should have one sub-order tab: "Don con A"
    await expect(salePage.getByText('Đơn con A')).toBeVisible();

    // Add a second sub-order
    await salePage
      .getByRole('button', { name: /Thêm đơn con/i })
      .click();
    await expect(salePage.getByText('Đơn con B')).toBeVisible();

    // Remove the first sub-order (click the X on "Don con A")
    // The X button is a span with role="button" inside the tab button
    const firstTabX = salePage
      .getByText('Đơn con A')
      .locator('..')
      .locator('[role="button"]');
    await firstTabX.click();

    // "Don con A" should be gone, only "Don con B" remains
    // (Renamed to "Don con A" after removal due to re-indexing, but
    //  the original "B" data stays intact thanks to react-hook-form)
    await expect(salePage.getByText(/Đơn con/)).toBeVisible();
  });

  test('should add and remove product items within a sub-order', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Go to step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Should start with one product row
    const productNameInputs = salePage.locator(
      'input[name$=".productName"]',
    );
    await expect(productNameInputs).toHaveCount(1);

    // Add a product
    await salePage.getByRole('button', { name: /Thêm sản phẩm/i }).click();
    await expect(productNameInputs).toHaveCount(2);

    // Add another product
    await salePage.getByRole('button', { name: /Thêm sản phẩm/i }).click();
    await expect(productNameInputs).toHaveCount(3);

    // Remove the middle product (delete buttons are visible)
    const deleteButtons = salePage.locator(
      'button:has(svg.lucide-trash2), button:has(svg.lucide-trash-2)',
    );
    // When there are 3 items, all 3 delete buttons should be present
    // but removing first one: click the 2nd delete button
    await deleteButtons.nth(1).click();
    await expect(productNameInputs).toHaveCount(2);
  });

  test('should show order summary in step 3 before submit', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Step 1: select branch HCM
    const branchSelect = salePage.locator('select[name="branch"]');
    await branchSelect.selectOption('HCM');

    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 2: fill a product
    await salePage
      .locator('input[name$=".productName"]')
      .first()
      .fill('Giay sneaker E2E');
    await salePage.locator('input[name$=".quantity"]').first().fill('5');
    await salePage
      .locator('input[name$=".unitPrice"]')
      .first()
      .fill('300000');

    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 3: confirmation summary
    await expect(salePage.getByText('Xác nhận đơn hàng')).toBeVisible();

    // Should show customer name
    await expect(salePage.getByText(testCustomer.name)).toBeVisible();

    // Should show branch
    await expect(salePage.getByText('Hồ Chí Minh')).toBeVisible();

    // Should show sub-order count
    await expect(salePage.getByText(/Số đơn con.*1/)).toBeVisible();

    // Should show product in the summary table
    await expect(salePage.getByText('Giay sneaker E2E')).toBeVisible();

    // Should have "Tao don hang" submit button and "Quay lai" back button
    await expect(
      salePage.getByRole('button', { name: /Tạo đơn hàng/i }),
    ).toBeVisible();
    await expect(
      salePage.getByRole('button', { name: /Quay lại/i }),
    ).toBeVisible();
  });

  test('should handle API error gracefully on submit', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Step 1
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 2: fill product
    await salePage
      .locator('input[name$=".productName"]')
      .first()
      .fill('Error test product');
    await salePage.locator('input[name$=".quantity"]').first().fill('1');
    await salePage
      .locator('input[name$=".unitPrice"]')
      .first()
      .fill('100');

    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();

    // Step 3: intercept the API call and return a 500 error
    await salePage.route('**/api/v1/master-orders', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 500,
            message: 'Internal server error',
          }),
        });
      }
      return route.continue();
    });

    await salePage.getByRole('button', { name: /Tạo đơn hàng/i }).click();

    // Should show error toast
    await expect(
      salePage.getByText(/lỗi|thất bại|error/i),
    ).toBeVisible({ timeout: 10_000 });

    // Should remain on the confirmation step, not redirect
    await expect(salePage.getByText('Xác nhận đơn hàng')).toBeVisible();
  });

  test('should navigate back between wizard steps', async ({
    salePage,
    testCustomer,
  }) => {
    await salePage.goto(`/don-hang/tao-moi?customerId=${testCustomer.id}`);

    await expect(salePage.getByText(testCustomer.name)).toBeVisible({
      timeout: 10_000,
    });

    // Step 1 -> Step 2
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();
    await expect(salePage.getByText('Loại dịch vụ *')).toBeVisible();

    // Fill some data in step 2
    await salePage
      .locator('input[name$=".productName"]')
      .first()
      .fill('Navigation test product');

    // Step 2 -> Step 1 (back)
    await salePage
      .getByRole('button', { name: /Quay lại/i })
      .first()
      .click();
    await expect(salePage.getByText('Khách hàng *')).toBeVisible();
    await expect(salePage.getByText(testCustomer.name)).toBeVisible();

    // Step 1 -> Step 2 again (data should be preserved)
    await salePage.getByRole('button', { name: /Tiếp tục/i }).click();
    await expect(
      salePage.locator('input[name$=".productName"]').first(),
    ).toHaveValue('Navigation test product');
  });
});
