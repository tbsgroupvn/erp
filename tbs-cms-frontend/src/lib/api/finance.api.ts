import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  AccountReceivable,
  AccountPayable,
  PaymentVoucher,
  Invoice,
  QueryParams,
  CreateVoucherDto,
  CreateInvoiceDto,
} from '@/lib/types';
import type { VoucherQueryParams, InvoiceQueryParams } from '@/lib/types/finance.types';

/** Log and re-throw API errors */
function handleApiError(error: unknown): never {
  console.error('Finance API error:', (error as Error)?.message || error);
  throw error;
}

// ---------------------------------------------------------------------------
// Accounts Receivable
// ---------------------------------------------------------------------------
export const arApi = {
  /** GET /ar */
  list: (params?: QueryParams) =>
    apiClient
      .get<PaginatedResponse<AccountReceivable>>('/ar', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** GET /ar/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<AccountReceivable>>(`/ar/${encodeURIComponent(id)}`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /ar/:id/payment */
  recordPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; reference?: string; notes?: string },
  ) =>
    apiClient
      .patch<BaseResponse<AccountReceivable>>(`/ar/${encodeURIComponent(id)}/payment`, data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /ar/overdue */
  getOverdue: () =>
    apiClient
      .get<BaseResponse<AccountReceivable[]>>('/ar/overdue')
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /ar/aging */
  getAging: () =>
    apiClient
      .get<
        BaseResponse<{
          current: number;
          days30: number;
          days60: number;
          days90: number;
          over90: number;
          total: number;
        }>
      >('/ar/aging')
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /ar/by-customer/:customerId */
  getCustomerDebt: (customerId: string) =>
    apiClient
      .get<BaseResponse<AccountReceivable[]>>(`/ar/by-customer/${encodeURIComponent(customerId)}`)
      .then((r) => r.data.data)
      .catch(handleApiError),
};

// ---------------------------------------------------------------------------
// Accounts Payable
// ---------------------------------------------------------------------------
export const apApi = {
  /** GET /ap */
  list: (params?: QueryParams) =>
    apiClient
      .get<PaginatedResponse<AccountPayable>>('/ap', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** GET /ap/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<AccountPayable>>(`/ap/${encodeURIComponent(id)}`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /ap/:id/payment */
  recordPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; reference?: string; notes?: string },
  ) =>
    apiClient
      .patch<BaseResponse<AccountPayable>>(`/ap/${encodeURIComponent(id)}/payment`, data)
      .then((r) => r.data.data)
      .catch(handleApiError),
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------
export const vouchersApi = {
  /** GET /cash/vouchers */
  list: (params?: VoucherQueryParams) =>
    apiClient
      .get<PaginatedResponse<PaymentVoucher>>('/cash/vouchers', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** POST /cash/vouchers */
  create: (data: CreateVoucherDto) =>
    apiClient
      .post<BaseResponse<PaymentVoucher>>('/cash/vouchers', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /cash/vouchers/:id/approve */
  approve: (id: string) =>
    apiClient
      .patch<BaseResponse<PaymentVoucher>>(`/cash/vouchers/${encodeURIComponent(id)}/approve`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /cash/vouchers/:id/reject */
  reject: (id: string, reason?: string) =>
    apiClient
      .patch<BaseResponse<PaymentVoucher>>(`/cash/vouchers/${encodeURIComponent(id)}/reject`, { reason })
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /cash/flow */
  getCashFlow: (params?: { dateFrom?: string; dateTo?: string }) =>
    apiClient
      .get<
        BaseResponse<
          { period: string; inflow: number; outflow: number; net: number; balance: number }[]
        >
      >('/cash/flow', { params })
      .then((r) => r.data.data)
      .catch(handleApiError),
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export const invoicesApi = {
  /** GET /invoices */
  list: (params?: InvoiceQueryParams) =>
    apiClient
      .get<PaginatedResponse<Invoice>>('/invoices', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** POST /invoices */
  create: (data: CreateInvoiceDto) =>
    apiClient
      .post<BaseResponse<Invoice>>('/invoices', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /invoices/:id/issue */
  issue: (id: string) =>
    apiClient
      .patch<BaseResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}/issue`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /invoices/:id/cancel */
  cancel: (id: string) =>
    apiClient
      .patch<BaseResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}/cancel`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** POST /invoices/:id/adjust */
  adjust: (
    id: string,
    data: { reason: string; adjustments: { itemId: string; newAmount: number }[] },
  ) =>
    apiClient
      .post<BaseResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}/adjust`, data)
      .then((r) => r.data.data)
      .catch(handleApiError),
};
