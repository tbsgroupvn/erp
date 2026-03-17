import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Dashboard - SALE role
// ---------------------------------------------------------------------------
test.describe('Dashboard - SALE role', () => {
  test('should display dashboard with greeting', async ({ salePage: page }) => {
    await page.goto('/tong-quan');

    // Page heading "Tong quan"
    await expect(
      page.getByRole('heading', { name: /tổng quan/i }),
    ).toBeVisible({ timeout: 15000 });

    // Greeting text "Xin chao, {fullName}"
    await expect(page.getByText(/xin chào/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show sales-specific stat cards', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    // SalesDashboard renders stat cards: "Tong don hang", "Doanh so", etc.
    await expect(page.getByText(/tổng đơn hàng/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/doanh số/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/khách hàng mới/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show recent orders section', async ({ salePage: page }) => {
    await page.goto('/tong-quan');

    // "Don hang gan day" section heading
    await expect(page.getByText(/đơn hàng gần đây/i)).toBeVisible({
      timeout: 15000,
    });

    // "Xem tat ca" link pointing to /don-hang
    const viewAllLink = page.getByRole('link', { name: /xem tất cả/i }).first();
    await expect(viewAllLink).toBeVisible({ timeout: 10000 });
    await expect(viewAllLink).toHaveAttribute('href', '/don-hang');
  });

  test('should navigate to order list from dashboard link', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    // Wait for dashboard to load, then click "Xem tat ca" link in recent orders
    await expect(page.getByText(/đơn hàng gần đây/i)).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('link', { name: /xem tất cả/i }).first().click();

    await expect(page).toHaveURL(/\/don-hang/, { timeout: 10000 });
  });

  test('should display notification bell in topbar', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    // NotificationBell has aria-label "Thong bao"
    await expect(
      page.getByRole('button', { name: /thông báo/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show correct sidebar menu items for SALE role', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    // SALE role has access to: Tong quan, Don hang, Bao gia, Hop dong, Khach hang, Khieu nai, Cong viec
    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Items SALE should see
    await expect(sidebar.getByRole('link', { name: /tổng quan/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /đơn hàng/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /khách hàng/i })).toBeVisible();

    // Items SALE should NOT see (e.g., Nhan su, So cai, Cai dat)
    await expect(
      sidebar.getByRole('link', { name: /^nhân sự$/i }),
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: /^sổ cái$/i }),
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole('link', { name: /^cài đặt$/i }),
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dashboard - CEO role
// ---------------------------------------------------------------------------
test.describe('Dashboard - CEO role', () => {
  test('should display BOD dashboard with revenue cards', async ({
    ceoPage: page,
  }) => {
    await page.goto('/tong-quan');

    await expect(
      page.getByRole('heading', { name: /tổng quan/i }),
    ).toBeVisible({ timeout: 15000 });

    // BodDashboard shows: "Tong don hang", "Doanh thu", "Cong no phai thu", "Khach hang moi"
    await expect(page.getByText(/tổng đơn hàng/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/doanh thu/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/công nợ phải thu/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show period filter buttons', async ({ ceoPage: page }) => {
    await page.goto('/tong-quan');

    // BodDashboard has period filter: "Hom nay", "7 ngay", "30 ngay", "Thang nay", "Quy nay"
    await expect(page.getByRole('button', { name: /hôm nay/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: /7 ngày/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /30 ngày/i })).toBeVisible();
  });

  test('should show all departments overview sections', async ({
    ceoPage: page,
  }) => {
    await page.goto('/tong-quan');

    // BodDashboard has sections: "Sales Pipeline", "Tai chinh - Cong no", "Nhan su"
    await expect(page.getByText(/sales pipeline/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/tài chính/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/nhân sự/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should see full sidebar menu with more items than SALE', async ({
    ceoPage: page,
  }) => {
    await page.goto('/tong-quan');

    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // CEO should see items that SALE cannot: Nhan su, So cai, Cai dat, Phe duyet
    await expect(sidebar.getByRole('link', { name: /^nhân sự$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^sổ cái$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^cài đặt$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^phê duyệt$/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dashboard - ACCOUNTANT role
// ---------------------------------------------------------------------------
test.describe('Dashboard - ACCOUNTANT role', () => {
  test('should display finance dashboard with greeting', async ({
    accountantPage: page,
  }) => {
    await page.goto('/tong-quan');

    await expect(
      page.getByRole('heading', { name: /tổng quan/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/xin chào/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show AR/AP summary stat cards', async ({
    accountantPage: page,
  }) => {
    await page.goto('/tong-quan');

    // FinanceDashboard shows: "Cong no phai thu", "Cong no phai tra", "Dong tien rong", "Phieu cho duyet"
    await expect(page.getByText(/công nợ phải thu/i).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/công nợ phải trả/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/dòng tiền ròng/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show AR/AP detail sections', async ({
    accountantPage: page,
  }) => {
    await page.goto('/tong-quan');

    // FinanceDashboard renders "Chi tiet phai thu (AR)" and "Chi tiet phai tra (AP)"
    await expect(page.getByText(/chi tiết phải thu/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/chi tiết phải trả/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should see finance-specific sidebar items', async ({
    accountantPage: page,
  }) => {
    await page.goto('/tong-quan');

    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // ACCOUNTANT should see: Cong no, So cai, Mua hang
    await expect(sidebar.getByRole('link', { name: /^công nợ$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^sổ cái$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^mua hàng$/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dashboard - Navigation
// ---------------------------------------------------------------------------
test.describe('Dashboard - Navigation', () => {
  test('should navigate to sidebar links correctly', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Click on "Khach hang" link
    await sidebar.getByRole('link', { name: /khách hàng/i }).click();
    await expect(page).toHaveURL(/\/khach-hang/, { timeout: 10000 });
  });

  test('should show active state on current sidebar item', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // The "Tong quan" link should have aria-current="page" when on /tong-quan
    const dashboardLink = sidebar.getByRole('link', { name: /tổng quan/i });
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  test('should update active state when navigating', async ({
    salePage: page,
  }) => {
    await page.goto('/tong-quan');

    const sidebar = page.getByRole('navigation', { name: /menu/i });
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Navigate to don-hang
    await sidebar.getByRole('link', { name: /đơn hàng/i }).click();
    await expect(page).toHaveURL(/\/don-hang/, { timeout: 10000 });

    // "Don hang" should now be the active link
    const orderLink = sidebar.getByRole('link', { name: /đơn hàng/i });
    await expect(orderLink).toHaveAttribute('aria-current', 'page');

    // "Tong quan" should no longer be active
    const dashboardLink = sidebar.getByRole('link', { name: /tổng quan/i });
    await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('should collapse and expand sidebar', async ({ salePage: page }) => {
    await page.goto('/tong-quan');

    // Collapse button has aria-label "Thu gon sidebar"
    const collapseButton = page.getByRole('button', {
      name: /thu gon sidebar/i,
    });
    await expect(collapseButton).toBeVisible({ timeout: 10000 });

    // Click to collapse
    await collapseButton.click();

    // After collapse, button should now say "Mo rong sidebar"
    const expandButton = page.getByRole('button', {
      name: /mo rong sidebar/i,
    });
    await expect(expandButton).toBeVisible({ timeout: 5000 });

    // Click to expand
    await expandButton.click();

    // Should be back to collapse button
    await expect(
      page.getByRole('button', { name: /thu gon sidebar/i }),
    ).toBeVisible({ timeout: 5000 });
  });
});
