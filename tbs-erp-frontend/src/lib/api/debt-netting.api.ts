import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type { DebtNetting } from '@/lib/types/finance.types';
import type { ApprovalStatus } from '@/lib/types/enums';

export interface NettingOpportunity {
  partnerId: string;
  partnerName: string;
  arTotal: number;
  apTotal: number;
  nettableAmount: number;
}

export interface CreateDebtNettingDto {
  partnerId: string;
  arIds: string[];
  apIds: string[];
  note?: string;
}

export interface DebtNettingQueryParams {
  page?: number;
  limit?: number;
  status?: ApprovalStatus;
  partnerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const debtNettingApi = {
  /** GET /debt-netting/opportunities — find nettable pairs */
  findOpportunities: () =>
    apiClient
      .get<BaseResponse<NettingOpportunity[]>>('/debt-netting/opportunities')
      .then((r) => r.data.data),

  /** POST /debt-netting — create netting request */
  create: (data: CreateDebtNettingDto) =>
    apiClient
      .post<BaseResponse<DebtNetting>>('/debt-netting', data)
      .then((r) => r.data.data),

  /** PATCH /debt-netting/:id/approve */
  approve: (id: string) =>
    apiClient
      .patch<BaseResponse<DebtNetting>>(`/debt-netting/${id}/approve`)
      .then((r) => r.data.data),

  /** POST /debt-netting/:id/execute */
  execute: (id: string) =>
    apiClient
      .post<BaseResponse<DebtNetting>>(`/debt-netting/${id}/execute`)
      .then((r) => r.data.data),

  /** GET /debt-netting */
  list: (params?: DebtNettingQueryParams) =>
    apiClient
      .get<PaginatedResponse<DebtNetting>>('/debt-netting', { params })
      .then((r) => r.data),

  /** GET /debt-netting/:id/history */
  getHistory: (id: string) =>
    apiClient
      .get<BaseResponse<DebtNetting[]>>(`/debt-netting/${id}/history`)
      .then((r) => r.data.data),
};
