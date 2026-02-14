import { apiClient } from './client';
import type {
  BaseResponse,
  DashboardOverview,
  DashboardQueryParams,
} from '@/lib/types';

export const dashboardApi = {
  getOverview(params?: DashboardQueryParams) {
    return apiClient.get<BaseResponse<DashboardOverview>>('/dashboard/overview', { params });
  },
};
