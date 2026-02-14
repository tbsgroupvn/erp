// ============================================
// DASHBOARD TYPES — Aggregated stats for dashboard views
// ============================================

import { Branch, OrderStatus } from './enums';

/** Top-level dashboard overview combining all stat groups */
export interface DashboardOverview {
  orders: OrderStats;
  finance: FinanceStats;
  warehouse: WarehouseStats;
}

/** Order statistics */
export interface OrderStats {
  totalOrders: number;
  newOrdersToday: number;
  ordersByStatus: Record<OrderStatus, number>;
  completionRate: number;
  averageProcessingDays: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number;
}

/** Finance statistics */
export interface FinanceStats {
  totalReceivable: number;
  totalPayable: number;
  overdueReceivable: number;
  overduePayable: number;
  cashInToday: number;
  cashOutToday: number;
  pendingVouchers: number;
  exchangeRateCNY: number;
}

/** Warehouse statistics */
export interface WarehouseStats {
  packagesCNPending: number;
  packagesCNToday: number;
  packagesVNPending: number;
  packagesVNToday: number;
  containersInTransit: number;
  containersAtCustoms: number;
  deliveriesPending: number;
  deliveriesToday: number;
}

/** HR statistics */
export interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  newEmployeesThisMonth: number;
  resignedThisMonth: number;
  attendanceRate: number;
  pendingLeaveRequests: number;
  overtimeHoursThisMonth: number;
  averageWorkingHours: number;
  departmentHeadcount: { department: string; count: number }[];
}

/** Query params for dashboard data */
export interface DashboardQueryParams {
  branch?: Branch;
  dateFrom?: string;
  dateTo?: string;
}
