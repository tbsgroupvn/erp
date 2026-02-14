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

// ---------------------------------------------------------------------------
// Accounts Receivable
// ---------------------------------------------------------------------------
export const arApi = {
  /** GET /finance/receivables */
  list: (params?: QueryParams) =>
    apiClient
      .get<PaginatedResponse<AccountReceivable>>('/finance/receivables', { params })
      .then((r) => r.data),

  /** GET /finance/receivables/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<AccountReceivable>>(`/finance/receivables/${id}`)
      .then((r) => r.data.data),

  /** POST /finance/receivables/:id/payment */
  recordPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; reference?: string; notes?: string },
  ) =>
    apiClient
      .post<BaseResponse<AccountReceivable>>(`/finance/receivables/${id}/payment`, data)
      .then((r) => r.data.data),

  /** GET /finance/receivables/overdue */
  getOverdue: () =>
    apiClient
      .get<BaseResponse<AccountReceivable[]>>('/finance/receivables/overdue')
      .then((r) => r.data.data),

  /** GET /finance/receivables/aging */
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
      >('/finance/receivables/aging')
      .then((r) => r.data.data),

  /** GET /finance/receivables/customer-debt?customerId=:id */
  getCustomerDebt: (customerId: string) =>
    apiClient
      .get<BaseResponse<AccountReceivable[]>>('/finance/receivables/customer-debt', {
        params: { customerId },
      })
      .then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// Accounts Payable
// ---------------------------------------------------------------------------
export const apApi = {
  /** GET /finance/payables */
  list: (params?: QueryParams) =>
    apiClient
      .get<PaginatedResponse<AccountPayable>>('/finance/payables', { params })
      .then((r) => r.data),

  /** GET /finance/payables/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<AccountPayable>>(`/finance/payables/${id}`)
      .then((r) => r.data.data),

  /** POST /finance/payables/:id/payment */
  recordPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; reference?: string; notes?: string },
  ) =>
    apiClient
      .post<BaseResponse<AccountPayable>>(`/finance/payables/${id}/payment`, data)
      .then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------
export const vouchersApi = {
  /** GET /finance/vouchers */
  list: (params?: VoucherQueryParams) =>
    apiClient
      .get<PaginatedResponse<PaymentVoucher>>('/finance/vouchers', { params })
      .then((r) => r.data),

  /** POST /finance/vouchers */
  create: (data: CreateVoucherDto) =>
    apiClient
      .post<BaseResponse<PaymentVoucher>>('/finance/vouchers', data)
      .then((r) => r.data.data),

  /** PATCH /finance/vouchers/:id/approve */
  approve: (id: string) =>
    apiClient
      .patch<BaseResponse<PaymentVoucher>>(`/finance/vouchers/${id}/approve`)
      .then((r) => r.data.data),

  /** PATCH /finance/vouchers/:id/reject */
  reject: (id: string, reason?: string) =>
    apiClient
      .patch<BaseResponse<PaymentVoucher>>(`/finance/vouchers/${id}/reject`, { reason })
      .then((r) => r.data.data),

  /** GET /finance/vouchers/cash-flow */
  getCashFlow: (params?: { dateFrom?: string; dateTo?: string }) =>
    apiClient
      .get<
        BaseResponse<
          { period: string; inflow: number; outflow: number; net: number; balance: number }[]
        >
      >('/finance/vouchers/cash-flow', { params })
      .then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export const invoicesApi = {
  /** GET /finance/invoices */
  list: (params?: InvoiceQueryParams) =>
    apiClient
      .get<PaginatedResponse<Invoice>>('/finance/invoices', { params })
      .then((r) => r.data),

  /** POST /finance/invoices */
  create: (data: CreateInvoiceDto) =>
    apiClient
      .post<BaseResponse<Invoice>>('/finance/invoices', data)
      .then((r) => r.data.data),

  /** PATCH /finance/invoices/:id/issue */
  issue: (id: string) =>
    apiClient
      .patch<BaseResponse<Invoice>>(`/finance/invoices/${id}/issue`)
      .then((r) => r.data.data),

  /** PATCH /finance/invoices/:id/cancel */
  cancel: (id: string) =>
    apiClient
      .patch<BaseResponse<Invoice>>(`/finance/invoices/${id}/cancel`)
      .then((r) => r.data.data),

  /** PATCH /finance/invoices/:id/adjust */
  adjust: (
    id: string,
    data: { reason: string; adjustments: { itemId: string; newAmount: number }[] },
  ) =>
    apiClient
      .patch<BaseResponse<Invoice>>(`/finance/invoices/${id}/adjust`, data)
      .then((r) => r.data.data),
};
