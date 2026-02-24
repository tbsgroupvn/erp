import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  PaymentVoucher,
  Invoice,
  AccountReceivable,
  AccountPayable,
  QueryParams,
} from '@/lib/types';

/** Log and re-throw API errors */
function handleApiError(error: unknown): never {
  console.error('Finance API error:', (error as Error)?.message || error);
  throw error;
}

export const financeApi = {
  listVouchers(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<PaymentVoucher>>('/cash/vouchers', { params })
      .catch(handleApiError);
  },
  listInvoices(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Invoice>>('/invoices', { params })
      .catch(handleApiError);
  },
  listAR(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<AccountReceivable>>('/ar', { params })
      .catch(handleApiError);
  },
  listAP(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<AccountPayable>>('/ap', { params })
      .catch(handleApiError);
  },
};
