'use client';

import { useQuery } from '@tanstack/react-query';
import {
  dashboardApi,
  type DashboardQueryParams,
} from '@/lib/api/dashboard.api';
import type {
  SalesPipelineQueryParams,
  AnalyticsQueryParams,
  OrderPnLQueryParams,
  MarginByRouteQueryParams,
  CashFlowForecastQueryParams,
  DrillDownQueryParams,
  MetricHistoryQueryParams,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (params?: DashboardQueryParams) =>
    [...dashboardKeys.all, 'overview', params] as const,
  orderStats: (params?: DashboardQueryParams) =>
    [...dashboardKeys.all, 'order-stats', params] as const,
  financeStats: (params?: DashboardQueryParams) =>
    [...dashboardKeys.all, 'finance-stats', params] as const,
  warehouseStats: (params?: DashboardQueryParams) =>
    [...dashboardKeys.all, 'warehouse-stats', params] as const,
  hrStats: (params?: DashboardQueryParams) =>
    [...dashboardKeys.all, 'hr-stats', params] as const,
  salesPipeline: (params?: SalesPipelineQueryParams) =>
    [...dashboardKeys.all, 'sales-pipeline', params] as const,
  analytics: (params?: AnalyticsQueryParams) =>
    [...dashboardKeys.all, 'analytics', params] as const,
  slaTracking: () => [...dashboardKeys.all, 'sla-tracking'] as const,
  orderPnl: (params?: OrderPnLQueryParams) =>
    [...dashboardKeys.all, 'order-pnl', params] as const,
  marginByRoute: (params?: MarginByRouteQueryParams) =>
    [...dashboardKeys.all, 'margin-by-route', params] as const,
  cashFlowForecast: (params?: CashFlowForecastQueryParams) =>
    [...dashboardKeys.all, 'cash-flow-forecast', params] as const,
  drillDown: (params: DrillDownQueryParams) =>
    [...dashboardKeys.all, 'drill-down', params] as const,
  metricHistory: (params: MetricHistoryQueryParams) =>
    [...dashboardKeys.all, 'metric-history', params] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDashboardOverview(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.overview(params),
    queryFn: () => dashboardApi.getOverview(params),
    refetchInterval: 60_000,
  });
}

export function useOrderStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.orderStats(params),
    queryFn: () => dashboardApi.getOrderStats(params),
    refetchInterval: 60_000,
  });
}

export function useFinanceStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.financeStats(params),
    queryFn: () => dashboardApi.getFinanceStats(params),
    refetchInterval: 60_000,
  });
}

export function useWarehouseStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.warehouseStats(params),
    queryFn: () => dashboardApi.getWarehouseStats(params),
    refetchInterval: 60_000,
  });
}

export function useHRStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.hrStats(params),
    queryFn: () => dashboardApi.getHRStats(params),
  });
}

export function useSalesPipeline(params?: SalesPipelineQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.salesPipeline(params),
    queryFn: () => dashboardApi.getSalesPipeline(params),
    refetchInterval: 60_000,
  });
}

export function useAnalytics(params?: AnalyticsQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.analytics(params),
    queryFn: () => dashboardApi.getAnalytics(params),
  });
}

export function useSlaTracking() {
  return useQuery({
    queryKey: dashboardKeys.slaTracking(),
    queryFn: () => dashboardApi.getSlaTracking(),
    refetchInterval: 60_000,
  });
}

export function useOrderPnl(params?: OrderPnLQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.orderPnl(params),
    queryFn: () => dashboardApi.getOrderPnl(params),
  });
}

export function useMarginByRoute(params?: MarginByRouteQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.marginByRoute(params),
    queryFn: () => dashboardApi.getMarginByRoute(params),
  });
}

export function useCashFlowForecast(params?: CashFlowForecastQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.cashFlowForecast(params),
    queryFn: () => dashboardApi.getCashFlowForecast(params),
  });
}

export function useDrillDown(metric: string, page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: dashboardKeys.drillDown({ metric, page, limit }),
    queryFn: () => dashboardApi.getDrillDown({ metric, page, limit }),
    enabled: !!metric,
  });
}

export function useMetricHistory(metric: string, days: number, branch?: string) {
  return useQuery({
    queryKey: dashboardKeys.metricHistory({ metric, days, branch }),
    queryFn: () => dashboardApi.getMetricHistory({ metric, days, branch }),
    enabled: !!metric,
  });
}
