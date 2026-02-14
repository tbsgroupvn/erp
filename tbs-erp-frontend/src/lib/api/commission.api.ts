import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export interface CommissionRule {
  id: string;
  name: string;
  serviceType: string;
  rate: number;
  minAmount: number;
  maxAmount: number | null;
  tieredRates: { min: number; max: number; rate: number }[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  employeeId: string;
  employeeName: string;
  orderId: string;
  orderCode: string;
  amount: number;
  rate: number;
  commissionAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  period: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface CommissionSummary {
  totalOrders: number;
  totalAmount: number;
  totalCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
}

export interface CreateCommissionRuleDto {
  name: string;
  serviceType: string;
  rate: number;
  minAmount?: number;
  maxAmount?: number;
  tieredRates?: { min: number; max: number; rate: number }[];
}

export interface CommissionQueryParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  status?: Commission['status'];
  period?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const commissionApi = {
  // --- Rules ---
  /** GET /commissions/rules */
  listRules: () =>
    apiClient
      .get<BaseResponse<CommissionRule[]>>('/commissions/rules')
      .then((r) => r.data.data),

  /** POST /commissions/rules */
  createRule: (data: CreateCommissionRuleDto) =>
    apiClient
      .post<BaseResponse<CommissionRule>>('/commissions/rules', data)
      .then((r) => r.data.data),

  /** PATCH /commissions/rules/:id */
  updateRule: (id: string, data: Partial<CreateCommissionRuleDto>) =>
    apiClient
      .patch<BaseResponse<CommissionRule>>(`/commissions/rules/${id}`, data)
      .then((r) => r.data.data),

  /** DELETE /commissions/rules/:id */
  deleteRule: (id: string) =>
    apiClient.delete(`/commissions/rules/${id}`).then((r) => r.data),

  // --- Calculations ---
  /** POST /commissions/calculate — calculate for a period */
  calculate: (period: string) =>
    apiClient
      .post<BaseResponse<Commission[]>>('/commissions/calculate', { period })
      .then((r) => r.data.data),

  /** GET /commissions/my — my commissions */
  getMyCommissions: (params?: CommissionQueryParams) =>
    apiClient
      .get<PaginatedResponse<Commission>>('/commissions/my', { params })
      .then((r) => r.data),

  /** GET /commissions/team — team commissions (leader/director) */
  getTeamCommissions: (params?: CommissionQueryParams) =>
    apiClient
      .get<PaginatedResponse<Commission>>('/commissions/team', { params })
      .then((r) => r.data),

  /** PATCH /commissions/:id/approve */
  approve: (id: string) =>
    apiClient
      .patch<BaseResponse<Commission>>(`/commissions/${id}/approve`)
      .then((r) => r.data.data),

  /** GET /commissions/monthly-report?period= */
  getMonthlyReport: (period: string) =>
    apiClient
      .get<BaseResponse<CommissionSummary>>('/commissions/monthly-report', {
        params: { period },
      })
      .then((r) => r.data.data),
};
