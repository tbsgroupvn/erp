import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Login page.
 *
 * Route: /login
 *
 * The page renders a form with email/password fields and a submit button.
 * On successful 2FA-required login, the form is replaced by a TwoFactorChallenge
 * component (role="region", aria-label="Xac thuc 2 yeu to").
 * Validation errors appear as role="alert" elements below each field.
 * Login failure triggers a sonner toast (not an inline alert).
 */
export class LoginPage {
  readonly page: Page;

  // --- Form elements ---
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly togglePasswordButton: Locator;

  // --- Validation errors (inline, role="alert") ---
  readonly emailError: Locator;
  readonly passwordError: Locator;

  // --- 2FA challenge ---
  readonly twoFactorRegion: Locator;
  readonly twoFactorHeading: Locator;
  readonly twoFactorError: Locator;
  readonly twoFactorBackButton: Locator;
  readonly backupCodeInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailInput = page.getByLabel('Email', { exact: false });
    this.passwordInput = page.getByLabel('Mật khẩu', { exact: false });
    this.submitButton = page.getByRole('button', { name: /Đăng nhập|Đang xử lý/ });
    this.togglePasswordButton = page.getByRole('button', { name: /Hiện mật khẩu|Ẩn mật khẩu/ });

    this.emailError = page.locator('#email-error');
    this.passwordError = page.locator('#password-error');

    this.twoFactorRegion = page.getByRole('region', { name: 'Xác thực 2 yếu tố' });
    this.twoFactorHeading = page.getByRole('heading', { name: 'Xác thực 2 yếu tố' });
    this.twoFactorError = this.twoFactorRegion.getByRole('alert');
    this.twoFactorBackButton = this.twoFactorRegion.getByRole('button', { name: 'Quay lại' });
    this.backupCodeInput = page.getByLabel('Mã backup');
  }

  /** Navigate to the login page. */
  async goto() {
    await this.page.goto('/login');
  }

  /** Fill email and password, then click submit. */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Assert that an inline validation error with the given message is visible. */
  async expectValidationError(message: string) {
    await expect(this.page.getByRole('alert').filter({ hasText: message })).toBeVisible();
  }

  /** Assert that a toast error with the given message appears. */
  async expectToastError(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  /** Assert that the page redirected to /tong-quan (dashboard). */
  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/\/tong-quan/);
  }

  /** Assert that the 2FA challenge screen is displayed. */
  async expect2FAChallenge() {
    await expect(this.twoFactorRegion).toBeVisible();
    await expect(this.twoFactorHeading).toBeVisible();
  }

  /**
   * Fill the 6-digit OTP code in the 2FA challenge.
   * Each digit is entered into a separate input field (aria-label="So thu N").
   */
  async fillOTP(code: string) {
    const digits = code.split('');
    for (let i = 0; i < digits.length; i++) {
      await this.page.getByLabel(`Số thứ ${i + 1}`).fill(digits[i]);
    }
  }

  /** Fill the backup code in the 2FA challenge. */
  async fillBackupCode(code: string) {
    await this.page.getByRole('button', { name: 'Dùng mã backup' }).click();
    await this.backupCodeInput.fill(code);
  }

  /** Switch to SMS mode in 2FA challenge. */
  async switchToSMS() {
    await this.page.getByRole('button', { name: 'Dùng mã SMS' }).click();
  }

  /** Assert the submit button shows loading state. */
  async expectLoading() {
    await expect(this.submitButton).toHaveText(/Đang xử lý/);
    await expect(this.submitButton).toBeDisabled();
  }
}
