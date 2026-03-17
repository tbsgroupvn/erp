import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Test credentials (from env or defaults)
// ---------------------------------------------------------------------------
const SALE_EMAIL = process.env.E2E_SALE_EMAIL || 'sale@tbs.vn';
const SALE_PASSWORD = process.env.E2E_SALE_PASSWORD || 'Sale123!@#';
const CEO_EMAIL = process.env.E2E_CEO_EMAIL || 'ceo@tbs.vn';
const CEO_PASSWORD = process.env.E2E_CEO_PASSWORD || 'Ceo123!@#';

// ---------------------------------------------------------------------------
// Login Flow
// ---------------------------------------------------------------------------
test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with correct elements', async ({ page }) => {
    // Page title / heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Email input
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('placeholder', 'email@tbs.vn');
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Password input
    const passwordInput = page.getByLabel(/mật khẩu/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit button
    await expect(
      page.getByRole('button', { name: /đăng nhập/i }),
    ).toBeVisible();

    // Password visibility toggle button
    await expect(
      page.getByRole('button', { name: /hiện mật khẩu/i }),
    ).toBeVisible();
  });

  test('should login successfully with valid SALE credentials and redirect to /tong-quan', async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill(SALE_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/tong-quan/, { timeout: 15000 });
  });

  test('should login successfully with CEO credentials and see BOD dashboard', async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill(CEO_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill(CEO_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    await expect(page).toHaveURL(/\/tong-quan/, { timeout: 15000 });

    // BOD dashboard shows period filter buttons (e.g., "30 ngay")
    await expect(
      page.getByRole('heading', { name: /tổng quan/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByLabel(/mật khẩu/i).fill('SomePass123!');
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Client-side validation: "Email khong hop le"
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/email không hợp lệ/i)).toBeVisible();
  });

  test('should show error for invalid password', async ({ page }) => {
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill('wrong-password-123');
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Server responds with error toast or inline alert
    // The toast shows "Dang nhap that bai" or backend message
    await expect(
      page.getByText(/thất bại|sai|không đúng|incorrect|invalid/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show error for empty fields', async ({ page }) => {
    // Leave both fields empty and submit
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Should see client-side validation errors
    await expect(page.getByRole('alert').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show error for password shorter than 6 characters', async ({
    page,
  }) => {
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill('abc');
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Client-side validation: "Mat khau toi thieu 6 ky tu"
    await expect(
      page.getByText(/mật khẩu tối thiểu 6 ký tự/i),
    ).toBeVisible();
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill(SALE_PASSWORD);

    const submitButton = page.getByRole('button', { name: /đăng nhập/i });
    await submitButton.click();

    // Button should show "Dang xu ly..." while the request is in-flight
    await expect(page.getByText(/đang xử lý/i)).toBeVisible({ timeout: 5000 });

    // The button should be disabled during loading
    await expect(submitButton).toBeDisabled();
  });

  test('should persist session across page reload', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill(SALE_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page).toHaveURL(/\/tong-quan/, { timeout: 15000 });

    // Reload the page
    await page.reload();

    // Should still be on the dashboard, not redirected to login
    await expect(page).toHaveURL(/\/tong-quan/, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: /tổng quan/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to login when accessing protected route without auth', async ({
    page,
  }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Try to access a protected route
    await page.goto('/don-hang');

    // Should be redirected to /login with callbackUrl
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/callbackUrl/, { timeout: 10000 });
  });

  test('should redirect back to intended page after login via callback URL', async ({
    page,
  }) => {
    // Clear auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Navigate to a protected route — should redirect to login with callbackUrl
    await page.goto('/don-hang');
    await expect(page).toHaveURL(/\/login.*callbackUrl/, { timeout: 10000 });

    // Now login
    await page.getByLabel(/email/i).fill(SALE_EMAIL);
    await page.getByLabel(/mật khẩu/i).fill(SALE_PASSWORD);
    await page.getByRole('button', { name: /đăng nhập/i }).click();

    // Should redirect to the originally intended page, not /tong-quan
    await expect(page).toHaveURL(/\/don-hang/, { timeout: 15000 });
  });

  test('should handle password visibility toggle', async ({ page }) => {
    const passwordInput = page.getByLabel(/mật khẩu/i);
    await passwordInput.fill('TestPassword');

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password button
    const toggleButton = page.getByRole('button', { name: /hiện mật khẩu/i });
    await toggleButton.click();

    // Now password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // aria-label should now say "An mat khau"
    await expect(
      page.getByRole('button', { name: /ẩn mật khẩu/i }),
    ).toBeVisible();

    // Click again to hide
    await page.getByRole('button', { name: /ẩn mật khẩu/i }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
