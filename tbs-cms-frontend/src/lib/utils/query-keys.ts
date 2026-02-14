// ============================================
// TANSTACK QUERY KEY FACTORY
// ============================================
//
// Convention: each resource exposes an object with methods
// that return tuple keys. This avoids magic strings and
// enables fine-grained invalidation.
//
// Usage:
//   queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
//   useQuery({ queryKey: orderKeys.detail(id), ... })
// ============================================

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  statusHistory: (orderId: string) =>
    [...orderKeys.detail(orderId), 'status-history'] as const,
};

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  wallet: (customerId: string) =>
    [...customerKeys.detail(customerId), 'wallet'] as const,
  contacts: (customerId: string) =>
    [...customerKeys.detail(customerId), 'contacts'] as const,
};

export const containerKeys = {
  all: ['containers'] as const,
  lists: () => [...containerKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...containerKeys.lists(), filters] as const,
  details: () => [...containerKeys.all, 'detail'] as const,
  detail: (id: string) => [...containerKeys.details(), id] as const,
};

export const packageKeys = {
  all: ['packages'] as const,
  lists: () => [...packageKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...packageKeys.lists(), filters] as const,
  details: () => [...packageKeys.all, 'detail'] as const,
  detail: (id: string) => [...packageKeys.details(), id] as const,
  byOrder: (orderId: string) =>
    [...packageKeys.all, 'by-order', orderId] as const,
  byContainer: (containerId: string) =>
    [...packageKeys.all, 'by-container', containerId] as const,
};

export const financeKeys = {
  all: ['finance'] as const,

  // Account Receivable
  receivables: () => [...financeKeys.all, 'receivables'] as const,
  receivableList: (filters: Record<string, unknown>) =>
    [...financeKeys.receivables(), 'list', filters] as const,
  receivableDetail: (id: string) =>
    [...financeKeys.receivables(), 'detail', id] as const,

  // Account Payable
  payables: () => [...financeKeys.all, 'payables'] as const,
  payableList: (filters: Record<string, unknown>) =>
    [...financeKeys.payables(), 'list', filters] as const,
  payableDetail: (id: string) =>
    [...financeKeys.payables(), 'detail', id] as const,

  // Vouchers
  vouchers: () => [...financeKeys.all, 'vouchers'] as const,
  voucherList: (filters: Record<string, unknown>) =>
    [...financeKeys.vouchers(), 'list', filters] as const,
  voucherDetail: (id: string) =>
    [...financeKeys.vouchers(), 'detail', id] as const,

  // Invoices
  invoices: () => [...financeKeys.all, 'invoices'] as const,
  invoiceList: (filters: Record<string, unknown>) =>
    [...financeKeys.invoices(), 'list', filters] as const,

  // Exchange rates
  exchangeRates: () => [...financeKeys.all, 'exchange-rates'] as const,
  latestRate: (from: string, to: string) =>
    [...financeKeys.exchangeRates(), from, to] as const,

  // Debt netting
  debtNettings: () => [...financeKeys.all, 'debt-nettings'] as const,
  debtNettingList: (filters: Record<string, unknown>) =>
    [...financeKeys.debtNettings(), 'list', filters] as const,
};

export const approvalKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...approvalKeys.lists(), filters] as const,
  details: () => [...approvalKeys.all, 'detail'] as const,
  detail: (id: string) => [...approvalKeys.details(), id] as const,
  pending: () => [...approvalKeys.all, 'pending'] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (filters: Record<string, unknown>) =>
    [...dashboardKeys.all, 'overview', filters] as const,
  orderStats: (filters: Record<string, unknown>) =>
    [...dashboardKeys.all, 'order-stats', filters] as const,
  financeStats: (filters: Record<string, unknown>) =>
    [...dashboardKeys.all, 'finance-stats', filters] as const,
  warehouseStats: (filters: Record<string, unknown>) =>
    [...dashboardKeys.all, 'warehouse-stats', filters] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

// ============================================
// P1 MODULE QUERY KEYS
// ============================================

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  headcount: (branch?: string) => [...employeeKeys.all, 'headcount', branch] as const,
};

export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...driverKeys.lists(), params] as const,
  details: () => [...driverKeys.all, 'detail'] as const,
  detail: (id: string) => [...driverKeys.details(), id] as const,
};

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...taskKeys.lists(), params] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const complaintKeys = {
  all: ['complaints'] as const,
  lists: () => [...complaintKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...complaintKeys.lists(), params] as const,
  details: () => [...complaintKeys.all, 'detail'] as const,
  detail: (id: string) => [...complaintKeys.details(), id] as const,
};

export const quotationKeys = {
  all: ['quotations'] as const,
  lists: () => [...quotationKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...quotationKeys.lists(), params] as const,
  details: () => [...quotationKeys.all, 'detail'] as const,
  detail: (id: string) => [...quotationKeys.details(), id] as const,
};

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...vendorKeys.lists(), params] as const,
  details: () => [...vendorKeys.all, 'detail'] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
};

export const purchaseKeys = {
  all: ['purchases'] as const,
  lists: () => [...purchaseKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...purchaseKeys.lists(), params] as const,
  details: () => [...purchaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseKeys.details(), id] as const,
};

export const fleetKeys = {
  all: ['fleet'] as const,
  lists: () => [...fleetKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...fleetKeys.lists(), params] as const,
  details: () => [...fleetKeys.all, 'detail'] as const,
  detail: (id: string) => [...fleetKeys.details(), id] as const,
};

export const trackingKeys = {
  all: ['tracking'] as const,
  lists: () => [...trackingKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...trackingKeys.lists(), params] as const,
  details: () => [...trackingKeys.all, 'detail'] as const,
  detail: (id: string) => [...trackingKeys.details(), id] as const,
};

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...payrollKeys.lists(), params] as const,
  details: () => [...payrollKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollKeys.details(), id] as const,
};

export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...inventoryKeys.lists(), params] as const,
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
};
