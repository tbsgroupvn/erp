// ============================================
// ROUTE PATH CONSTANTS
// ============================================

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  FORGOT_PASSWORD: '/doi-mat-khau',

  // Dashboard
  DASHBOARD: '/dashboard',

  // Orders
  ORDERS: '/don-hang',
  ORDERS_NEW: '/don-hang/tao-moi',
  ORDER_DETAIL: (id: string) => `/don-hang/${id}` as const,

  // Quotations
  QUOTATIONS: '/bao-gia',
  QUOTATION_DETAIL: (id: string) => `/bao-gia/${id}` as const,
  QUOTATION_CREATE: '/bao-gia/tao-moi',

  // Customers
  CUSTOMERS: '/khach-hang',
  CUSTOMERS_NEW: '/khach-hang/tao-moi',
  CUSTOMER_DETAIL: (id: string) => `/khach-hang/${id}` as const,

  // Warehouse
  WAREHOUSE: '/kho',
  WAREHOUSE_CN: '/kho/trung-quoc',
  WAREHOUSE_VN: '/kho/viet-nam',
  WAREHOUSE_RECEIVE: '/kho/nhan-hang',
  WAREHOUSE_MEASURE: '/kho/can-do',

  // Containers
  CONTAINERS: '/container',
  CONTAINERS_NEW: '/container/tao-moi',
  CONTAINER_DETAIL: (id: string) => `/container/${id}` as const,

  // Delivery
  DELIVERIES: '/giao-hang',
  DELIVERY_DETAIL: (id: string) => `/giao-hang/${id}` as const,

  // Tracking
  TRACKING: '/theo-doi',

  // Fleet / Vehicles
  FLEET: '/phuong-tien',
  VEHICLE_DETAIL: (id: string) => `/phuong-tien/${id}` as const,

  // Drivers
  DRIVERS: '/tai-xe',
  DRIVER_DETAIL: (id: string) => `/tai-xe/${id}` as const,

  // Finance
  FINANCE: '/tai-chinh',
  FINANCE_RECEIVABLES: '/tai-chinh/cong-no-phai-thu',
  FINANCE_PAYABLES: '/tai-chinh/cong-no-phai-tra',
  FINANCE_VOUCHERS: '/tai-chinh/chung-tu',
  FINANCE_VOUCHER_NEW: '/tai-chinh/chung-tu/tao-moi',
  FINANCE_INVOICES: '/tai-chinh/hoa-don',
  FINANCE_EXCHANGE_RATES: '/tai-chinh/ty-gia',
  FINANCE_DEBT_NETTING: '/tai-chinh/bu-tru-cong-no',

  // Purchases
  PURCHASES: '/mua-hang',
  PURCHASE_DETAIL: (id: string) => `/mua-hang/${id}` as const,
  PURCHASE_CREATE: '/mua-hang/tao-moi',

  // Vendors
  VENDORS: '/nha-cung-cap',
  VENDOR_DETAIL: (id: string) => `/nha-cung-cap/${id}` as const,

  // Inventory (Kho vat tu)
  INVENTORY: '/kho-vat-tu',

  // Employees / HR
  EMPLOYEES: '/nhan-su',
  EMPLOYEE_DETAIL: (id: string) => `/nhan-su/${id}` as const,
  EMPLOYEE_CREATE: '/nhan-su/tao-moi',

  // Payroll
  PAYROLL: '/luong',

  // Tasks
  TASKS: '/cong-viec',
  TASK_DETAIL: (id: string) => `/cong-viec/${id}` as const,
  TASK_CREATE: '/cong-viec/tao-moi',

  // Complaints
  COMPLAINTS: '/khieu-nai',
  COMPLAINT_DETAIL: (id: string) => `/khieu-nai/${id}` as const,
  COMPLAINT_CREATE: '/khieu-nai/tao-moi',

  // Documents
  DOCUMENTS: '/tai-lieu',

  // Approvals
  APPROVALS: '/duyet',
  APPROVAL_DETAIL: (id: string) => `/duyet/${id}` as const,

  // Reports
  REPORTS: '/bao-cao',
  REPORTS_REVENUE: '/bao-cao/doanh-thu',
  REPORTS_ORDERS: '/bao-cao/don-hang',
  REPORTS_CUSTOMERS: '/bao-cao/khach-hang',
  REPORTS_WAREHOUSE: '/bao-cao/kho',

  // Settings
  SETTINGS: '/cai-dat',
  SETTINGS_PROFILE: '/cai-dat/ho-so',
  SETTINGS_USERS: '/cai-dat/nguoi-dung',
  SETTINGS_SYSTEM: '/cai-dat/he-thong',
} as const;
