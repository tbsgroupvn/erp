import { apiClient } from './client';
import type {
  BaseResponse,
  DashboardOverview,
  OrderStats,
  FinanceStats,
  WarehouseStats,
  HRStats,
  DashboardQueryParams,
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
};
