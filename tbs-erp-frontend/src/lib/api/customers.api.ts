import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryParams,
  Wallet,
  TopupWalletDto,
  CustomerAnalytics,
  ChurnRiskEntry,
} from '@/lib/types';

export interface CustomerTrendPoint {
  month: string; // "YYYY-MM"
  label: string; // "Thg 1", "Thg 2" ...
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
}

export interface CustomerTrendData {
  customerId: string;
  months: CustomerTrendPoint[];
}

export const customersApi = {
  /** GET /customers */
  list: (params?: CustomerQueryParams) =>
    apiClient
      .get<PaginatedResponse<Customer>>('/customers', {
        params: params
          ? Object.fromEntries(
              Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
            )
          : undefined,
      })
      .then((r) => r.data),

  /** GET /customers/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Customer>>(`/customers/${id}`)
      .then((r) => r.data.data),

  /** POST /customers */
  create: (data: CreateCustomerDto) =>
    apiClient
      .post<BaseResponse<Customer>>('/customers', data)
      .then((r) => r.data.data),

  /** POST /customers/quick */
  createQuick: (data: { fullName: string; phone: string; email?: string; note?: string; source?: string; }) =>
    apiClient
      .post<BaseResponse<Customer>>('/customers/quick', data)
      .then((r) => r.data.data),

  /** PATCH /customers/:id */
  update: (id: string, data: UpdateCustomerDto) =>
    apiClient
      .patch<BaseResponse<Customer>>(`/customers/${id}`, data)
      .then((r) => r.data.data),

  /** GET /customers/:id/wallet */
  getWallet: (id: string) =>
    apiClient
      .get<BaseResponse<Wallet>>(`/customers/${id}/wallet`)
      .then((r) => r.data.data),

  /** POST /customers/:id/wallet/topup */
  topupWallet: (id: string, data: Omit<TopupWalletDto, 'customerId'>) =>
    apiClient
      .post<BaseResponse<Wallet>>(`/customers/${id}/wallet/topup`, data)
      .then((r) => r.data.data),

  /** GET /customers/:id/interaction-notes */
  getInteractionNotes: (customerId: string) =>
    apiClient
      .get<BaseResponse<any[]>>(`/customers/${customerId}/interaction-notes`)
      .then((r) => r.data.data),

  /** POST /customers/:id/interaction-notes */
  createInteractionNote: (customerId: string, data: { content: string; channel: string }) =>
    apiClient
      .post<BaseResponse<any>>(`/customers/${customerId}/interaction-notes`, data)
      .then((r) => r.data.data),

  /** GET /crm/customers/:id/analytics */
  getCustomerAnalytics: (customerId: string) =>
    apiClient
      .get<BaseResponse<CustomerAnalytics>>(`/crm/customers/${customerId}/analytics`)
      .then((r) => r.data.data),

  /** GET /crm/analytics/churn-risk */
  getChurnRiskList: (page: number, limit: number) =>
    apiClient
      .get<PaginatedResponse<ChurnRiskEntry>>('/crm/analytics/churn-risk', {
        params: { page, limit },
      })
      .then((r) => r.data),

  /** GET /crm/customers/:id/trend — 12-month order/revenue trend */
  getCustomerTrend: (customerId: string) =>
    apiClient
      .get<BaseResponse<CustomerTrendData>>(`/crm/customers/${customerId}/trend`)
      .then((r) => r.data.data),
};
