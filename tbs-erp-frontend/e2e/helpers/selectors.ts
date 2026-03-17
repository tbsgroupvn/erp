/**
 * Common selectors and test IDs for TBS ERP E2E tests.
 *
 * Prefer Playwright's accessible locators (getByRole, getByLabel, getByText)
 * over test IDs. Use these constants only when semantic locators are ambiguous
 * or unavailable.
 *
 * Usage:
 *   import { SELECTORS, tid } from './selectors';
 *   await page.getByTestId(SELECTORS.SIDEBAR_NAV);
 */

// ---------------------------------------------------------------------------
// Helper: build a data-testid selector string
// ---------------------------------------------------------------------------
export function tid(testId: string) {
  return testId;
}

// ---------------------------------------------------------------------------
// Shared test IDs — keep in sync with data-testid attributes in the app
// ---------------------------------------------------------------------------
export const SELECTORS = {
  // Layout
  SIDEBAR_NAV: 'sidebar-nav',
  TOPBAR: 'topbar',
  NOTIFICATION_BELL: 'notification-bell',
  USER_MENU: 'user-menu',

  // Auth
  LOGIN_FORM: 'login-form',
  LOGOUT_BUTTON: 'logout-button',

  // Dashboard
  DASHBOARD_STATS: 'dashboard-stats',

  // Orders
  ORDER_TABLE: 'order-table',
  ORDER_FORM: 'order-form',
  ORDER_STATUS_BADGE: 'order-status',

  // Customers
  CUSTOMER_TABLE: 'customer-table',
  CUSTOMER_FORM: 'customer-form',

  // Containers
  CONTAINER_TABLE: 'container-table',

  // Finance
  FINANCE_AR_TABLE: 'ar-table',
  FINANCE_AP_TABLE: 'ap-table',
  CASH_VOUCHER_TABLE: 'cash-voucher-table',

  // Warehouse
  WAREHOUSE_CN_TABLE: 'warehouse-cn-table',
  WAREHOUSE_VN_TABLE: 'warehouse-vn-table',

  // Shared components
  DATA_TABLE: 'data-table',
  PAGINATION: 'pagination',
  SEARCH_INPUT: 'search-input',
  CONFIRM_DIALOG: 'confirm-dialog',
  CONFIRM_DIALOG_OK: 'confirm-dialog-ok',
  CONFIRM_DIALOG_CANCEL: 'confirm-dialog-cancel',
  EMPTY_STATE: 'empty-state',
  LOADING_SPINNER: 'loading-spinner',
} as const;

// ---------------------------------------------------------------------------
// Accessible name constants (Vietnamese UI labels)
// ---------------------------------------------------------------------------
export const LABELS = {
  // Navigation items
  NAV_DASHBOARD: /Tổng quan/i,
  NAV_ORDERS: /Đơn hàng/i,
  NAV_CUSTOMERS: /Khách hàng/i,
  NAV_CONTAINERS: /Container/i,
  NAV_WAREHOUSE_CN: /Kho Trung Quốc/i,
  NAV_WAREHOUSE_VN: /Kho Việt Nam/i,
  NAV_FINANCE: /Tài chính/i,

  // Common buttons
  BTN_CREATE: /Tạo mới/i,
  BTN_SAVE: /Lưu/i,
  BTN_CANCEL: /Hủy/i,
  BTN_DELETE: /Xóa/i,
  BTN_EDIT: /Sửa/i,
  BTN_SEARCH: /Tìm kiếm/i,
  BTN_EXPORT: /Xuất/i,
  BTN_IMPORT: /Nhập/i,

  // Form labels
  FIELD_EMAIL: /Email/i,
  FIELD_PASSWORD: /Mật khẩu/i,
  FIELD_NAME: /Tên/i,
  FIELD_PHONE: /Điện thoại|Số điện thoại/i,
  FIELD_ADDRESS: /Địa chỉ/i,
  FIELD_NOTES: /Ghi chú/i,
} as const;
