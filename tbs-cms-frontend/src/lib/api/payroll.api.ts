import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  PayrollRecord,
  PayrollSummary,
  PayrollQueryParams,
} from '@/lib/types/payroll.types';

export const payrollApi = {
  /** GET /payroll */
  list: (params?: PayrollQueryParams) =>
    apiClient
      .get<PaginatedResponse<PayrollRecord>>('/payroll', { params })
      .then((r) => r.data),

  /** GET /payroll/summary */
  summary: (params?: { month: number; year: number }) =>
    apiClient
      .get<BaseResponse<PayrollSummary>>('/payroll/summary', { params })
      .then((r) => r.data.data),

  /** POST /payroll/calculate */
  calculate: (params: { month: number; year: number }) =>
    apiClient
      .post<BaseResponse<void>>('/payroll/calculate', params)
      .then((r) => r.data),

  /** PATCH /payroll/approve */
  approve: (params: { month: number; year: number }) =>
    apiClient
      .patch<BaseResponse<void>>('/payroll/approve', params)
      .then((r) => r.data),
};
