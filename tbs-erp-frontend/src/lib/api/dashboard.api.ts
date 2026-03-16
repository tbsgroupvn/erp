import { apiClient } from './client';
import type {
  BaseResponse,
  DashboardOverview,
  OrderStats,
  FinanceStats,
  WarehouseStats,
  HRStats,
  DashboardQueryParams,
  SalesPipelineData,
  SalesPipelineQueryParams,
  AnalyticsData,
  AnalyticsQueryParams,
  SlaTrackingData,
  OrderPnLItem,
  OrderPnLQueryParams,
  MarginByRouteData,
  MarginByRouteQueryParams,
  CashFlowForecastData,
  CashFlowForecastQueryParams,
  DrillDownData,
  DrillDownQueryParams,
  MetricHistoryData,
  MetricHistoryQueryParams,
} from '@/lib/types';

export type { DashboardQueryParams };

export const dashboardApi = {
  /** GET /dashboard/overview */
  getOverview: (params?: DashboardQueryParams) =>
    apiClient
      .get<BaseResponse<DashboardOverview>>('/dashboard/overview', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/orders */
  getOrderStats: (params?: DashboardQueryParams) =>
    apiClient
      .get<BaseResponse<OrderStats>>('/dashboard/orders', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/finance */
  getFinanceStats: (params?: DashboardQueryParams) =>
    apiClient
      .get<BaseResponse<FinanceStats>>('/dashboard/finance', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/warehouse */
  getWarehouseStats: (params?: DashboardQueryParams) =>
    apiClient
      .get<BaseResponse<WarehouseStats>>('/dashboard/warehouse', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/hr */
  getHRStats: (params?: DashboardQueryParams) =>
    apiClient
      .get<BaseResponse<HRStats>>('/dashboard/hr', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/sales-pipeline */
  getSalesPipeline: (params?: SalesPipelineQueryParams) =>
    apiClient
      .get<BaseResponse<SalesPipelineData>>('/dashboard/sales-pipeline', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/analytics */
  getAnalytics: (params?: AnalyticsQueryParams) =>
    apiClient
      .get<BaseResponse<AnalyticsData>>('/dashboard/analytics', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/sla-tracking */
  getSlaTracking: () =>
    apiClient
      .get<BaseResponse<SlaTrackingData>>('/dashboard/sla-tracking')
      .then((r) => r.data.data),

  /** GET /dashboard/reports/order-pnl */
  getOrderPnl: (params?: OrderPnLQueryParams) =>
    apiClient
      .get<BaseResponse<OrderPnLItem[]>>('/dashboard/reports/order-pnl', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/reports/margin-by-route */
  getMarginByRoute: (params?: MarginByRouteQueryParams) =>
    apiClient
      .get<BaseResponse<MarginByRouteData>>('/dashboard/reports/margin-by-route', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/reports/cash-flow-forecast */
  getCashFlowForecast: (params?: CashFlowForecastQueryParams) =>
    apiClient
      .get<BaseResponse<CashFlowForecastData>>('/dashboard/reports/cash-flow-forecast', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/drill-down?metric=&page=&limit= */
  getDrillDown: (params: DrillDownQueryParams) =>
    apiClient
      .get<BaseResponse<DrillDownData>>('/dashboard/drill-down', { params })
      .then((r) => r.data.data),

  /** GET /dashboard/metric-history?metric=&days=&branch= */
  getMetricHistory: (params: MetricHistoryQueryParams) =>
    apiClient
      .get<BaseResponse<MetricHistoryData>>('/dashboard/metric-history', { params })
      .then((r) => r.data.data),
};
