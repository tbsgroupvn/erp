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
} from '@/lib/types';

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
};
