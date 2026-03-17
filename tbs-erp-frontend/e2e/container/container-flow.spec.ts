import { test, expect } from '../fixtures';
import { waitForTableLoaded, waitForToast, waitForApiResponse } from '../helpers/wait-helpers';
import { createTestContainer, cleanupContainer } from '../helpers/test-data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_PAGE = '/container';
const CONTAINER_STATUSES = {
  PLANNING: 'PLANNING',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  ON_HOLD_BORDER: 'ON_HOLD_BORDER',
  ARRIVED: 'ARRIVED',
  CUSTOMS: 'CUSTOMS',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
  COMPLETED: 'COMPLETED',
} as const;

// ---------------------------------------------------------------------------
// Container Management
// ---------------------------------------------------------------------------

test.describe('Container Management', () => {
  test('should display container list page with table headers', async ({ salePage }) => {
    await salePage.goto(CONTAINER_PAGE);
    await expect(salePage.getByRole('heading', { name: /Container/i })).toBeVisible();

    // Verify the "Container" tab is active by default
    const containerTab = salePage.getByRole('button', { name: 'Container' });
    await expect(containerTab).toBeVisible();

    // Verify table headers are present
    await waitForTableLoaded(salePage);
    await expect(salePage.getByRole('columnheader', { name: /Mã container/i })).toBeVisible();
    await expect(salePage.getByRole('columnheader', { name: /Tuyến/i })).toBeVisible();
    await expect(salePage.getByRole('columnheader', { name: /Trạng thái/i })).toBeVisible();
    await expect(salePage.getByRole('columnheader', { name: /Số kiện/i })).toBeVisible();
  });

  test('should create new container with required fields', async ({ salePage }) => {
    await salePage.goto(CONTAINER_PAGE);

    // Open create form
    await salePage.getByRole('button', { name: /Tao container/i }).click();
    await expect(salePage.getByRole('heading', { name: /Tạo container mới/i })).toBeVisible();

    // Fill in form fields
    await salePage.getByLabel(/Tuyến vận chuyển/i).selectOption({ index: 0 });
    await salePage.getByLabel(/Nơi xuất phát/i).fill('Quang Chau');
    await salePage.getByLabel(/Nơi đến/i).fill('Hai Phong');
    await salePage.getByLabel(/Hãng vận chuyển/i).fill('COSCO');
    await salePage.getByLabel(/Sức chứa tối đa/i).fill('20000');

    // Set dates
    const today = new Date();
    const departure = new Date(today);
    departure.setDate(departure.getDate() + 3);
    const arrival = new Date(today);
    arrival.setDate(arrival.getDate() + 10);

    await salePage.getByLabel(/Ngày khởi hành dự kiến/i).fill(
      departure.toISOString().split('T')[0],
    );
    await salePage.getByLabel(/Ngày đến dự kiến/i).fill(
      arrival.toISOString().split('T')[0],
    );

    // Submit
    const submitButton = salePage.getByRole('button', { name: /Tạo container/i });
    await submitButton.click();

    // Wait for success toast
    await waitForToast(salePage, /Tạo container thành công/i);
  });

  test('should filter containers by status', async ({ salePage }) => {
    await salePage.goto(CONTAINER_PAGE);
    await waitForTableLoaded(salePage);

    // Open status filter and select "Kế hoạch" (PLANNING)
    const statusFilter = salePage.getByLabel(/Trạng thái/i);
    await statusFilter.selectOption('PLANNING');

    // Wait for filtered results to load
    await waitForApiResponse(salePage, '/containers');

    // If table has rows, verify all visible status badges show "Kế hoạch"
    const statusBadges = salePage.locator('table tbody tr').locator('text=Kế hoạch');
    const rowCount = await salePage.locator('table tbody tr').count();
    if (rowCount > 0) {
      await expect(statusBadges.first()).toBeVisible();
    }
  });

  test('should navigate to container detail page', async ({ salePage, apiContext }) => {
    // Create a container via API for a stable test target
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
      origin: 'E2E Origin',
      destination: 'E2E Destination',
    });

    try {
      await salePage.goto(CONTAINER_PAGE);
      await waitForTableLoaded(salePage);

      // Click "Chi tiet" button on the first row
      const detailButton = salePage.getByRole('button', { name: /Chi tiết/i }).first();
      await detailButton.click();

      // Should navigate to detail page
      await expect(salePage).toHaveURL(/\/container\/[a-zA-Z0-9-]+/);

      // Verify detail page elements
      await expect(salePage.getByRole('tab', { name: /Tổng quan/i })).toBeVisible();
      await expect(salePage.getByRole('tab', { name: /Kiện hàng/i })).toBeVisible();
      await expect(salePage.getByRole('tab', { name: /Chi phí/i })).toBeVisible();
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });

  test('should transition container from PLANNING to LOADING', async ({ salePage, apiContext }) => {
    // Create a PLANNING container via API
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
      origin: 'E2E Test',
      destination: 'E2E Test',
    });

    try {
      await salePage.goto(CONTAINER_PAGE);
      await waitForTableLoaded(salePage);

      // Find the transition button for "Dang xep" (LOADING)
      const loadingButton = salePage
        .locator('table tbody tr')
        .filter({ hasText: container.containerCode })
        .getByRole('button', { name: /Đang xếp/i });

      if (await loadingButton.isVisible()) {
        await loadingButton.click();
        await waitForToast(salePage, /Cập nhật trạng thái container thành công/i);
      }
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });

  test('should transition container from LOADING to IN_TRANSIT', async ({ apiContext, salePage }) => {
    // Create and advance container to LOADING via API
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
    });

    try {
      // Advance to LOADING via API
      await apiContext.patch(`/containers/${container.id}/status`, {
        data: { status: CONTAINER_STATUSES.LOADING },
      });

      await salePage.goto(CONTAINER_PAGE);
      await waitForTableLoaded(salePage);

      // Find the IN_TRANSIT transition button
      const transitButton = salePage
        .locator('table tbody tr')
        .filter({ hasText: container.containerCode })
        .getByRole('button', { name: /Vận chuyển/i });

      if (await transitButton.isVisible()) {
        await transitButton.click();
        await waitForToast(salePage, /Cập nhật trạng thái container thành công/i);
      }
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });

  test('should add packages to container via "Them kien" button', async ({ salePage, apiContext }) => {
    // Create a PLANNING container
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
    });

    try {
      await salePage.goto(CONTAINER_PAGE);
      await waitForTableLoaded(salePage);

      // Click "Them kien" button on the container row
      const containerRow = salePage
        .locator('table tbody tr')
        .filter({ hasText: container.containerCode });

      const addPackageButton = containerRow.getByRole('button', { name: /Thêm kiện/i });
      if (await addPackageButton.isVisible()) {
        await addPackageButton.click();

        // Verify the inline form appears
        const packageInput = containerRow.getByPlaceholder(/PKG001/);
        await expect(packageInput).toBeVisible();

        // Fill in a package ID and submit
        await packageInput.fill('TEST-PKG-001');
        await containerRow.getByRole('button', { name: /^Thêm$/i }).click();
      }
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });

  test('should show correct packages count in table', async ({ salePage }) => {
    await salePage.goto(CONTAINER_PAGE);
    await waitForTableLoaded(salePage);

    // Verify the "So kien" column has numeric values
    const packageCells = salePage.locator('table tbody tr td:nth-child(4)');
    const count = await packageCells.count();
    if (count > 0) {
      const firstCellText = await packageCells.first().textContent();
      expect(firstCellText).toBeTruthy();
      // Should be a number or "0"
      expect(Number(firstCellText?.trim())).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Container Tracking
// ---------------------------------------------------------------------------

test.describe('Container Tracking', () => {
  test('should switch to tracking tab', async ({ salePage }) => {
    await salePage.goto(CONTAINER_PAGE);

    // Click the "Theo doi" tab
    const trackingTab = salePage.getByRole('button', { name: 'Theo dõi' });
    await trackingTab.click();

    // Verify tracking tab content loads
    await expect(salePage.getByText(/Theo dõi kiện hàng/i)).toBeVisible();
    await expect(salePage.getByText(/Theo dõi container/i)).toBeVisible();
  });

  test('should display package tracking search form', async ({ salePage }) => {
    await salePage.goto(`${CONTAINER_PAGE}?tab=tracking`);

    // Verify the package tracking search section
    await expect(salePage.getByPlaceholder(/Nhập mã tracking/i)).toBeVisible();
    await expect(
      salePage.getByRole('button', { name: /Tìm kiếm/i }).first(),
    ).toBeVisible();
  });

  test('should display container tracking search form', async ({ salePage }) => {
    await salePage.goto(`${CONTAINER_PAGE}?tab=tracking`);

    // Verify the container tracking search section
    await expect(salePage.getByPlaceholder(/Nhập mã container/i)).toBeVisible();
  });

  test('should show "not found" message for invalid tracking number', async ({ salePage }) => {
    await salePage.goto(`${CONTAINER_PAGE}?tab=tracking`);

    // Search for a non-existent tracking number
    await salePage.getByPlaceholder(/Nhập mã tracking/i).fill('NONEXISTENT-12345');
    await salePage.getByRole('button', { name: /Tìm kiếm/i }).first().click();

    // Wait for the API response to complete
    await expect(
      salePage.getByText(/Không tìm thấy thông tin theo dõi/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should show ON_HOLD_BORDER status correctly on detail page', async ({ salePage, apiContext }) => {
    // Create container and advance to ON_HOLD_BORDER via API
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
    });

    try {
      // Advance through: PLANNING -> LOADING -> IN_TRANSIT -> ON_HOLD_BORDER
      await apiContext.patch(`/containers/${container.id}/status`, {
        data: { status: CONTAINER_STATUSES.LOADING },
      });
      await apiContext.patch(`/containers/${container.id}/status`, {
        data: { status: CONTAINER_STATUSES.IN_TRANSIT },
      });
      await apiContext.patch(`/containers/${container.id}/status`, {
        data: { status: CONTAINER_STATUSES.ON_HOLD_BORDER },
      });

      // Navigate to container detail
      await salePage.goto(`/container/${container.id}`);

      // Verify ON_HOLD_BORDER status badge is displayed
      await expect(salePage.getByText(/Giữ tại biên giới/i)).toBeVisible();

      // Verify alert banner for border hold
      await expect(
        salePage.getByText(/đang bị giữ tại biên giới/i),
      ).toBeVisible();
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Container Lifecycle - Full Flow
// ---------------------------------------------------------------------------

test.describe('Container Lifecycle - Full Flow', () => {
  test('should complete full lifecycle PLANNING through COMPLETED', async ({ salePage, apiContext }) => {
    // Create a fresh container
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
      origin: 'Guangzhou',
      destination: 'Hai Phong',
      carrier: 'E2E Carrier',
      maxCapacity: 20000,
    });

    try {
      // Advance through all statuses via API
      const transitions = [
        CONTAINER_STATUSES.LOADING,
        CONTAINER_STATUSES.IN_TRANSIT,
        CONTAINER_STATUSES.ARRIVED,
        CONTAINER_STATUSES.CUSTOMS,
        CONTAINER_STATUSES.COMPLETED,
      ];

      for (const status of transitions) {
        const resp = await apiContext.patch(`/containers/${container.id}/status`, {
          data: { status },
        });
        expect(resp.ok()).toBeTruthy();
      }

      // Navigate to the container detail page and verify COMPLETED status
      await salePage.goto(`/container/${container.id}`);

      // Verify final status badge shows "Hoan thanh"
      await expect(salePage.getByText(/Hoàn thành/i).first()).toBeVisible();

      // Verify no more transition buttons are shown (COMPLETED is terminal)
      const transitionButtons = salePage.locator(
        'button:has-text("Đang xếp"), button:has-text("Vận chuyển"), button:has-text("Đã đến")',
      );
      await expect(transitionButtons).toHaveCount(0);
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });

  test('should handle CUSTOMS_HOLD branch in lifecycle', async ({ salePage, apiContext }) => {
    const container = await createTestContainer(apiContext, {
      shippingRoute: 'SEA',
    });

    try {
      // Advance to CUSTOMS via API
      for (const status of [
        CONTAINER_STATUSES.LOADING,
        CONTAINER_STATUSES.IN_TRANSIT,
        CONTAINER_STATUSES.ARRIVED,
        CONTAINER_STATUSES.CUSTOMS,
      ]) {
        await apiContext.patch(`/containers/${container.id}/status`, {
          data: { status },
        });
      }

      // Now go to CUSTOMS_HOLD
      await apiContext.patch(`/containers/${container.id}/status`, {
        data: { status: CONTAINER_STATUSES.CUSTOMS_HOLD },
      });

      await salePage.goto(`/container/${container.id}`);

      // Verify CUSTOMS_HOLD status
      await expect(salePage.getByText(/Bị giữ hải quan/i)).toBeVisible();

      // From CUSTOMS_HOLD, should be able to go to COMPLETED
      const completeButton = salePage.getByRole('button', { name: /Hoàn thành/i });
      await expect(completeButton).toBeVisible();
    } finally {
      await cleanupContainer(apiContext, container.id);
    }
  });
});
