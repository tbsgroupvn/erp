'use client';

import { useQuery } from '@tanstack/react-query';
import {
  dashboardApi,
  type DashboardQueryParams,
} from '@/lib/api/dashboard.api';

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
  });
}

export function useFinanceStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.financeStats(params),
    queryFn: () => dashboardApi.getFinanceStats(params),
  });
}

export function useWarehouseStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.warehouseStats(params),
    queryFn: () => dashboardApi.getWarehouseStats(params),
  });
}

export function useHRStats(params?: DashboardQueryParams) {
  return useQuery({
    queryKey: dashboardKeys.hrStats(params),
    queryFn: () => dashboardApi.getHRStats(params),
  });
}
