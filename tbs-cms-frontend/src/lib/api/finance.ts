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

export const financeApi = {
  listVouchers(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<PaymentVoucher>>('/finance/vouchers', { params });
  },
  listInvoices(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Invoice>>('/finance/invoices', { params });
  },
  listAR(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<AccountReceivable>>('/finance/ar', { params });
  },
  listAP(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<AccountPayable>>('/finance/ap', { params });
  },
};
