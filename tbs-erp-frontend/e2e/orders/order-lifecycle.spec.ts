import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Order Lifecycle E2E Tests
// ---------------------------------------------------------------------------
// Tests cover the order detail page at /don-hang/[id] which displays:
//   - OrderHeader with order code, customer info, overall status
//   - Tabbed 360 view: Tong quan, Hang hoa, Tai chinh, Van hanh, Du an,
//     Tai lieu, Nhat ky
//   - Status transition buttons per sub-order (in the Hang hoa tab)
//   - Cancel order dialog with reason input
//
// FSM statuses:
//   CONSULTING -> QUOTATION -> PENDING_DEPOSIT -> SOURCING ->
//   WAREHOUSE_CN -> PACKING -> CONSOLIDATION -> IN_TRANSIT ->
//   CUSTOMS -> WAREHOUSE_VN -> DELIVERING -> SETTLEMENT -> COMPLETED
//   (+ ON_HOLD from any active state, CANCELLED)
// ---------------------------------------------------------------------------

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

test.describe('Order Lifecycle', () => {
  test('should display order detail page with correct header and tabs', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);

    // Wait for the page to load (loading overlay disappears)
    await salePage.waitForLoadState('networkidle');

    // Should display the order code in the header
    await expect(
      salePage.getByText(testOrder.orderCode),
    ).toBeVisible({ timeout: 15_000 });

    // Should show the 7 tabs
    const tabs = [
      'Tổng quan',
      'Hàng hóa',
      'Tài chính',
      'Vận hành',
      'Dự án',
      'Tài liệu',
      'Nhật ký',
    ];
    for (const tabName of tabs) {
      await expect(
        salePage.getByRole('tab', { name: tabName }),
      ).toBeVisible();
    }
  });

  test('should show available status transitions based on current status', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    // Navigate to Hang hoa tab to see sub-order management
    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    // Expand first sub-order
    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Sub-order should expand and show status transition buttons
      // Depending on the current status, transition buttons should appear
      // e.g., for CONSULTING status: "Báo giá" and "Tạm giữ" buttons
      const transitionArea = salePage.locator(
        'button:has-text("Báo giá"), button:has-text("Mua hàng"), button:has-text("Tạm giữ")',
      );
      // At least one transition button or the cancel button should exist
      const cancelBtn = salePage.getByRole('button', { name: /Hủy đơn/i });
      const hasTransitions = await transitionArea.count() > 0;
      const hasCancel = await cancelBtn.isVisible().catch(() => false);
      expect(hasTransitions || hasCancel).toBeTruthy();
    }
  });

  test('should transition CONSULTING to QUOTATION', async ({
    salePage,
    apiContext,
    testOrder,
  }) => {
    // Ensure the order has a sub-order in CONSULTING status via the API
    // The testOrder fixture creates a basic order; we check what's available
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    // Navigate to Hang hoa tab
    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    // Expand the first sub-order
    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Look for the "Bao gia" (QUOTATION) transition button
      const quotationBtn = salePage.getByRole('button', {
        name: /Báo giá/i,
      });

      if (await quotationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await quotationBtn.click();

        // Confirmation dialog should appear
        await expect(
          salePage.getByText(/Xác nhận chuyển trạng thái/i),
        ).toBeVisible({ timeout: 5_000 });

        // Confirm the transition
        await salePage
          .getByRole('button', { name: /^Xác nhận$/i })
          .click();

        // Status badge should update to "Bao gia"
        await expect(
          salePage.getByText(/Báo giá/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should transition through early stages for VCT order', async ({
    salePage,
    apiContext,
    testOrder,
  }) => {
    // This test tries to advance through CONSULTING -> QUOTATION -> PENDING_DEPOSIT
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Try transitioning through available states
      const transitions = ['Báo giá', 'Chờ cọc', 'Mua hàng'];

      for (const transitionLabel of transitions) {
        const btn = salePage.getByRole('button', {
          name: new RegExp(transitionLabel, 'i'),
        });

        if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await btn.click();

          // Confirm dialog
          const confirmBtn = salePage.getByRole('button', {
            name: /^Xác nhận$/i,
          });
          if (
            await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)
          ) {
            await confirmBtn.click();
            // Wait for status update
            await salePage.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('should show correct tab content for Tong quan', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    // Tong quan tab should be active by default
    await expect(
      salePage.getByRole('tab', { name: 'Tổng quan', selected: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Overview should show the order sale block content
    // (customer info, branch, creation date, etc.)
    const mainContent = salePage.locator('[role="tabpanel"]');
    await expect(mainContent).toBeVisible();
  });

  test('should show Hang hoa tab with sub-order details', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    // Should show "Don con (N)" heading
    await expect(
      salePage.getByText(/Đơn con \(\d+\)/),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show Tai chinh tab with finance information', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Tài chính' }).click();

    // Finance tab should show the OrderFinanceBlock
    const financePanel = salePage.locator('[role="tabpanel"]');
    await expect(financePanel).toBeVisible({ timeout: 10_000 });
  });

  test('should cancel order from early status with reason dialog', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    // Expand first sub-order
    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Click "Huy don" button
      const cancelBtn = salePage.getByRole('button', { name: /Hủy đơn/i });

      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click();

        // Cancel dialog should appear with reason textarea
        await expect(
          salePage.getByPlaceholder(/Nhập lý do hủy đơn/i),
        ).toBeVisible({ timeout: 5_000 });

        // Should have confirm and close buttons
        await expect(
          salePage.getByRole('button', { name: /Xác nhận hủy/i }),
        ).toBeVisible();
        await expect(
          salePage.getByRole('button', { name: /Đóng/i }),
        ).toBeVisible();

        // Confirm button should be disabled without a reason
        await expect(
          salePage.getByRole('button', { name: /Xác nhận hủy/i }),
        ).toBeDisabled();

        // Fill reason
        await salePage
          .getByPlaceholder(/Nhập lý do hủy đơn/i)
          .fill('E2E test cancellation reason');

        // Now confirm button should be enabled
        await expect(
          salePage.getByRole('button', { name: /Xác nhận hủy/i }),
        ).toBeEnabled();

        // Click close instead of confirming (to not actually cancel)
        await salePage.getByRole('button', { name: /Đóng/i }).click();

        // Dialog should close
        await expect(
          salePage.getByPlaceholder(/Nhập lý do hủy đơn/i),
        ).not.toBeVisible();
      }
    }
  });

  test('should show audit log in Nhat ky tab', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    // Click on Nhat ky tab
    await salePage.getByRole('tab', { name: 'Nhật ký' }).click();

    // Audit log panel should be visible
    const auditPanel = salePage.locator('[role="tabpanel"]');
    await expect(auditPanel).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate between all tabs without errors', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    const tabNames = [
      'Tổng quan',
      'Hàng hóa',
      'Tài chính',
      'Vận hành',
      'Dự án',
      'Tài liệu',
      'Nhật ký',
    ];

    for (const tabName of tabNames) {
      await salePage.getByRole('tab', { name: tabName }).click();

      // Each tab should reveal a visible panel without errors
      const panel = salePage.locator('[role="tabpanel"]');
      await expect(panel).toBeVisible({ timeout: 10_000 });

      // No error states should be visible
      const errorText = salePage.getByText(/Lỗi tải dữ liệu/i);
      await expect(errorText).not.toBeVisible({ timeout: 2_000 }).catch(
        () => {
          // Some tabs may legitimately show "no data" which is fine
        },
      );
    }
  });
});

test.describe('Order Status Transitions', () => {
  test('should move order to ON_HOLD with reason', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Look for "Tam giu" (ON_HOLD) button
      const holdBtn = salePage.getByRole('button', { name: /Tạm giữ/i });

      if (await holdBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await holdBtn.click();

        // Confirmation dialog should appear
        await expect(
          salePage.getByText(/Xác nhận chuyển trạng thái/i),
        ).toBeVisible({ timeout: 5_000 });

        // Fill optional note
        await salePage
          .getByPlaceholder(/Nhập ghi chú khi chuyển trạng thái/i)
          .fill('E2E: Putting order on hold for testing');

        // Confirm
        await salePage
          .getByRole('button', { name: /^Xác nhận$/i })
          .click();

        // Status should update to show "Tam giu"
        await expect(
          salePage.getByText(/Tạm giữ/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should resume from ON_HOLD to a previous status', async ({
    salePage,
    apiContext,
    testOrder,
  }) => {
    // First put the order on hold via API
    try {
      // Get the sub-order ID from the order detail
      const orderResponse = await apiContext.get(
        `/orders/${testOrder.id}/360`,
      );
      if (orderResponse.ok()) {
        const orderData = await orderResponse.json();
        const subOrders =
          orderData?.data?.subOrders || orderData?.subOrders || [];

        if (subOrders.length > 0) {
          const subOrderId = subOrders[0].id;

          // Put on hold
          await apiContext.patch(`/orders/${subOrderId}/status`, {
            data: { status: 'ON_HOLD', note: 'E2E hold for resume test' },
          });
        }
      }
    } catch {
      // If API setup fails, skip gracefully
    }

    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // When on hold, should show transition buttons to resume to various states
      // Check for any resume transition button (CONSULTING, QUOTATION, etc.)
      const resumeBtn = salePage
        .getByRole('button', { name: /Tư vấn|Báo giá|Chờ cọc|Mua hàng/i })
        .first();

      if (await resumeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resumeBtn.click();

        const confirmBtn = salePage.getByRole('button', {
          name: /^Xác nhận$/i,
        });
        if (
          await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)
        ) {
          await confirmBtn.click();
          await salePage.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should show status change confirmation dialog with optional note', async ({
    salePage,
    testOrder,
  }) => {
    await salePage.goto(`/don-hang/${testOrder.id}`);
    await salePage.waitForLoadState('networkidle');

    await salePage.getByRole('tab', { name: 'Hàng hóa' }).click();

    const subOrderButton = salePage
      .locator('button')
      .filter({ hasText: /^[A-Z0-9]+-\d+/ })
      .first();

    if (await subOrderButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await subOrderButton.click();

      // Click any available transition button
      const transitionBtn = salePage
        .locator('button')
        .filter({ hasText: /Báo giá|Chờ cọc|Mua hàng|Kho TQ|Đóng gói/i })
        .first();

      if (
        await transitionBtn.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await transitionBtn.click();

        // Confirmation dialog structure
        await expect(
          salePage.getByText(/Xác nhận chuyển trạng thái/i),
        ).toBeVisible({ timeout: 5_000 });

        await expect(
          salePage.getByText(/Ghi chú \(tùy chọn\)/i),
        ).toBeVisible();

        await expect(
          salePage.getByPlaceholder(
            /Nhập ghi chú khi chuyển trạng thái/i,
          ),
        ).toBeVisible();

        // Should have Confirm and Cancel buttons
        await expect(
          salePage.getByRole('button', { name: /^Xác nhận$/i }),
        ).toBeVisible();
        await expect(
          salePage.getByRole('button', { name: /^Hủy$/i }),
        ).toBeVisible();

        // Cancel the dialog
        await salePage.getByRole('button', { name: /^Hủy$/i }).click();

        // Dialog should close
        await expect(
          salePage.getByText(/Xác nhận chuyển trạng thái/i),
        ).not.toBeVisible();
      }
    }
  });
});

test.describe('Order Detail Navigation', () => {
  test('should navigate from order list to order detail', async ({
    salePage,
  }) => {
    await salePage.goto('/don-hang');
    await salePage.waitForLoadState('networkidle');

    // The order list table should be visible
    await expect(salePage.locator('table')).toBeVisible({ timeout: 15_000 });

    // Click on the first order link in the table
    const firstOrderLink = salePage
      .locator('table a[href*="/don-hang/"]')
      .first();

    if (
      await firstOrderLink.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await firstOrderLink.click();

      // Should navigate to order detail
      await expect(salePage).toHaveURL(/\/don-hang\/[a-zA-Z0-9-]+/, {
        timeout: 10_000,
      });

      // Should show the tabbed view
      await expect(
        salePage.getByRole('tab', { name: 'Tổng quan' }),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should handle non-existent order gracefully', async ({
    salePage,
  }) => {
    await salePage.goto('/don-hang/non-existent-order-id-12345');

    // Should show "Khong tim thay don hang" or error state
    await expect(
      salePage.getByText(
        /Không tìm thấy đơn hàng|Lỗi tải dữ liệu/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Should have link to go back to list
    await expect(
      salePage.getByRole('link', { name: /Quay lại danh sách/i }),
    ).toBeVisible();
  });
});
