// ============================================
// DASHBOARD TYPES — Aggregated stats for dashboard views
// ============================================

import { Branch, OrderStatus } from './enums';

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface DashboardQueryParams {
  branch?: Branch;
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesPipelineQueryParams {
  saleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsQueryParams {
  metric?: 'revenue' | 'orders' | 'containers';
  period?: '6m' | '12m' | '24m';
}

export interface OrderPnLQueryParams {
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MarginByRouteQueryParams {
  dateFrom?: string;
  dateTo?: string;
}

export interface CashFlowForecastQueryParams {
  days?: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/overview
// ---------------------------------------------------------------------------

export interface DashboardOverview {
  period: { start: string; end: string };
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  newCustomers: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/orders
// ---------------------------------------------------------------------------

export interface OrderByStatusItem {
  status: OrderStatus;
  count: number;
  totalAmount: number;
}

export interface OrderByServiceTypeItem {
  serviceType: string;
  count: number;
  totalAmount: number;
}

export interface OrderStats {
  period: { start: string; end: string };
  byStatus: OrderByStatusItem[];
  byServiceType: OrderByServiceTypeItem[];
  activeOrders: number;
  pendingDeposit: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/finance
// ---------------------------------------------------------------------------

export interface ARAPSummary {
  totalOutstanding: number;
  overdueAmount: number;
  openCount: number;
  overdueCount: number;
}

export interface CashFlowSummary {
  monthlyInflow: number;
  monthlyOutflow: number;
  netFlow: number;
  inflowCount: number;
  outflowCount: number;
}

export interface FinanceStats {
  accountsReceivable: ARAPSummary;
  accountsPayable: ARAPSummary;
  cashFlow: CashFlowSummary;
  pendingVouchers: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/warehouse
// ---------------------------------------------------------------------------

export interface WarehouseStats {
  warehouseCN: number;
  packing: number;
  consolidation: number;
  inTransit: number;
  atCustoms: number;
  warehouseVN: number;
  pendingDelivery: number;
  delivering: number;
  pipeline: { total: number };
}

// ---------------------------------------------------------------------------
// GET /dashboard/hr
// ---------------------------------------------------------------------------

export interface HRStats {
  period: { start: string; end: string };
  totalEmployees: number;
  newHires: number;
  resigned: number;
  byDepartment: { department: string; count: number }[];
}

// ---------------------------------------------------------------------------
// GET /dashboard/sales-pipeline
// ---------------------------------------------------------------------------

export interface SalesPipelineData {
  pipeline: {
    consulting: number;
    quotation: number;
    pendingDeposit: number;
    sourcing: number;
    warehouseCN: number;
    inTransit: number;
    warehouseVN: number;
    delivering: number;
    settlement: number;
    completed: number;
    totalActive: number;
  };
  pendingDeposits: {
    count: number;
    totalDepositRequired: number;
  };
  vnArrivalsNeedingNotification: number;
  overdueAR: {
    count: number;
    totalOutstanding: number;
  };
  verifiedRevenue: {
    orderCount: number;
    totalAmount: number;
    totalDepositPaid: number;
  };
  period: {
    from: string | null;
    to: string | null;
  };
}

// ---------------------------------------------------------------------------
// GET /dashboard/analytics
// ---------------------------------------------------------------------------

export interface MonthlyComparison {
  year: number;
  month: number;
  value: number;
  previousYearValue: number | null;
  yoyChangePercent: number | null;
  movingAverage3m: number | null;
}

export interface AnalyticsData {
  metric: string;
  period: string;
  data: MonthlyComparison[];
  summary: {
    currentPeriodTotal: number;
    previousPeriodTotal: number;
    overallYoyChangePercent: number | null;
    latestMovingAverage: number | null;
  };
}

// ---------------------------------------------------------------------------
// GET /dashboard/sla-tracking
// ---------------------------------------------------------------------------

export interface SlaBreachedOrder {
  id: string;
  code: string;
  status: string;
  daysSinceUpdate: number;
}

export interface SlaTrackingData {
  totalActiveOrders: number;
  slaBreaches: number;
  complianceRate: number;
  breachedOrders: SlaBreachedOrder[];
}

// ---------------------------------------------------------------------------
// GET /dashboard/reports/order-pnl
// ---------------------------------------------------------------------------

export interface OrderPnLItem {
  orderId: string;
  code: string;
  revenue: number;
  cost: number;
  netProfit: number;
  marginPercent: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/reports/margin-by-route
// ---------------------------------------------------------------------------

export interface RouteMarginItem {
  route: string;
  orderCount: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

export interface MarginByRouteData {
  routes: RouteMarginItem[];
}

// ---------------------------------------------------------------------------
// GET /dashboard/reports/cash-flow-forecast
// ---------------------------------------------------------------------------

export interface CashFlowWeek {
  weekStart: string;
  weekEnd: string;
  inflow: number;
  outflow: number;
  netPosition: number;
}

export interface CashFlowForecastData {
  weeks: CashFlowWeek[];
  summary: {
    totalInflow: number;
    totalOutflow: number;
    netPosition: number;
  };
}

// ---------------------------------------------------------------------------
// GET /dashboard/drill-down
// ---------------------------------------------------------------------------

export interface DrillDownOrderRow {
  id: string;
  code: string;
  status: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
}

export interface DrillDownARRow {
  id: string;
  code: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
}

export interface DrillDownContainerRow {
  id: string;
  code: string;
  status: string;
  route: string;
  packageCount: number;
  eta: string | null;
}

export interface DrillDownCustomerRow {
  id: string;
  code: string;
  name: string;
  tier: string;
  totalOrders: number;
  totalRevenue: number;
}

export type DrillDownRow =
  | DrillDownOrderRow
  | DrillDownARRow
  | DrillDownContainerRow
  | DrillDownCustomerRow;

export interface DrillDownData {
  metric: string;
  rows: DrillDownRow[];
  total: number;
  page: number;
  limit: number;
}

export interface DrillDownQueryParams {
  metric: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// GET /dashboard/metric-history
// ---------------------------------------------------------------------------

export interface MetricHistoryPoint {
  date: string;
  value: number;
}

export interface MetricHistoryData {
  metric: string;
  days: number;
  points: MetricHistoryPoint[];
}

export interface MetricHistoryQueryParams {
  metric: string;
  days: number;
  branch?: string;
}
