'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  arApi,
  apApi,
  vouchersApi,
  invoicesApi,
  vasApi,
  reconciliationApi,
} from '@/lib/api/finance.api';
import type { QueryParams, CreateVoucherDto, CreateInvoiceDto } from '@/lib/types';
import type { VoucherQueryParams, InvoiceQueryParams } from '@/lib/types/finance.types';
import type { VasReportParams, ManualMatchDto } from '@/lib/api/finance.api';

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------
export const financeKeys = {
  // AR
  ar: {
    all: ['receivables'] as const,
    lists: () => [...financeKeys.ar.all, 'list'] as const,
    list: (params?: QueryParams) =>
      [...financeKeys.ar.lists(), params] as const,
    detail: (id: string) => [...financeKeys.ar.all, 'detail', id] as const,
    overdue: () => [...financeKeys.ar.all, 'overdue'] as const,
    aging: () => [...financeKeys.ar.all, 'aging'] as const,
    customerDebt: (customerId: string) =>
      [...financeKeys.ar.all, 'customer-debt', customerId] as const,
  },
  // AP
  ap: {
    all: ['payables'] as const,
    lists: () => [...financeKeys.ap.all, 'list'] as const,
    list: (params?: QueryParams) =>
      [...financeKeys.ap.lists(), params] as const,
    detail: (id: string) => [...financeKeys.ap.all, 'detail', id] as const,
  },
  // Vouchers
  vouchers: {
    all: ['vouchers'] as const,
    lists: () => [...financeKeys.vouchers.all, 'list'] as const,
    list: (params?: VoucherQueryParams) =>
      [...financeKeys.vouchers.lists(), params] as const,
    cashFlow: () => [...financeKeys.vouchers.all, 'cash-flow'] as const,
  },
  // Invoices
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...financeKeys.invoices.all, 'list'] as const,
    list: (params?: InvoiceQueryParams) =>
      [...financeKeys.invoices.lists(), params] as const,
  },
  // VAS Report
  vas: {
    all: ['vas-report'] as const,
    report: (params: VasReportParams) => [...financeKeys.vas.all, params] as const,
  },
  // Reconciliation
  reconciliation: {
    all: ['reconciliation'] as const,
    summary: () => [...financeKeys.reconciliation.all, 'summary'] as const,
  },
};

// ---------------------------------------------------------------------------
// AR Hooks
// ---------------------------------------------------------------------------

export function useReceivables(params?: QueryParams & { customerId?: string; status?: string }) {
  return useQuery({
    queryKey: financeKeys.ar.list(params),
    queryFn: () => arApi.list(params),
  });
}

export function useReceivable(id: string) {
  return useQuery({
    queryKey: financeKeys.ar.detail(id),
    queryFn: () => arApi.getById(id),
    enabled: !!id,
  });
}

export function useRecordArPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { amount: number; reference?: string; note?: string };
    }) => arApi.recordPayment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.ar.all });
      toast.success('Ghi nhận thanh toán thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận thanh toán');
    },
  });
}

// ---------------------------------------------------------------------------
// AP Hooks
// ---------------------------------------------------------------------------

export function usePayables(params?: QueryParams) {
  return useQuery({
    queryKey: financeKeys.ap.list(params),
    queryFn: () => apApi.list(params),
  });
}

export function useRecordApPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { amount: number; reference?: string; note?: string };
    }) => apApi.recordPayment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.ap.all });
      toast.success('Ghi nhận thanh toán thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận thanh toán');
    },
  });
}

// ---------------------------------------------------------------------------
// Voucher Hooks
// ---------------------------------------------------------------------------

export function useVouchers(params?: VoucherQueryParams) {
  return useQuery({
    queryKey: financeKeys.vouchers.list(params),
    queryFn: () => vouchersApi.list(params),
  });
}

export function useCreateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVoucherDto) => vouchersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.vouchers.lists() });
      toast.success('Tạo phiếu thu/chi thành công');
    },
    onError: () => {
      toast.error('Không thể tạo phiếu thu/chi');
    },
  });
}

export function useApproveVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vouchersApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.vouchers.lists() });
      toast.success('Đã duyệt phiếu');
    },
    onError: () => {
      toast.error('Không thể duyệt phiếu');
    },
  });
}

export function useRejectVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      vouchersApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.vouchers.lists() });
      toast.success('Đã từ chối phiếu');
    },
    onError: () => {
      toast.error('Không thể từ chối phiếu');
    },
  });
}

// ---------------------------------------------------------------------------
// Invoice Hooks
// ---------------------------------------------------------------------------

export function useInvoices(params?: InvoiceQueryParams) {
  return useQuery({
    queryKey: financeKeys.invoices.list(params),
    queryFn: () => invoicesApi.list(params),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceDto) => invoicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.invoices.lists() });
      toast.success('Tạo hóa đơn thành công');
    },
    onError: () => {
      toast.error('Không thể tạo hóa đơn');
    },
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.issue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.invoices.all });
      toast.success('Phát hành hóa đơn thành công');
    },
    onError: () => {
      toast.error('Không thể phát hành hóa đơn');
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.invoices.all });
      toast.success('Hủy hóa đơn thành công');
    },
    onError: () => {
      toast.error('Không thể hủy hóa đơn');
    },
  });
}

export function useAdjustInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { reason: string; adjustments: { itemId: string; newAmount: number }[] };
    }) => invoicesApi.adjust(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.invoices.all });
      toast.success('Điều chỉnh hóa đơn thành công');
    },
    onError: () => {
      toast.error('Không thể điều chỉnh hóa đơn');
    },
  });
}

// ---------------------------------------------------------------------------
// Additional Finance Query Hooks
// ---------------------------------------------------------------------------

export function useOverdueReceivables() {
  return useQuery({
    queryKey: financeKeys.ar.overdue(),
    queryFn: () => arApi.getOverdue(),
  });
}

export function useAgingReport() {
  return useQuery({
    queryKey: financeKeys.ar.aging(),
    queryFn: () => arApi.getAging(),
  });
}

export function useCustomerDebt(customerId: string) {
  return useQuery({
    queryKey: financeKeys.ar.customerDebt(customerId),
    queryFn: () => arApi.getCustomerDebt(customerId),
    enabled: !!customerId,
  });
}

export function useCustomerDebtSummary() {
  return useQuery({
    queryKey: [...financeKeys.ar.all, 'customer-summary'] as const,
    queryFn: () => arApi.getCustomerSummary(),
  });
}

export function useCashFlow(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: [...financeKeys.vouchers.cashFlow(), params] as const,
    queryFn: () => vouchersApi.getCashFlow(params),
  });
}

// ---------------------------------------------------------------------------
// VAS Report Hooks
// ---------------------------------------------------------------------------

export function useVasReport(params: VasReportParams, enabled = true) {
  return useQuery({
    queryKey: financeKeys.vas.report(params),
    queryFn: () => vasApi.getReport(params),
    enabled: enabled && !!params.dateFrom && !!params.dateTo,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Reconciliation Hooks
// ---------------------------------------------------------------------------

export function useReconciliationSummary() {
  return useQuery({
    queryKey: financeKeys.reconciliation.summary(),
    queryFn: () => reconciliationApi.getSummary(),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useManualMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ManualMatchDto) => reconciliationApi.manualMatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.reconciliation.all });
      qc.invalidateQueries({ queryKey: financeKeys.ar.all });
      toast.success('Khớp lệnh thủ công thành công');
    },
    onError: () => {
      toast.error('Không thể khớp lệnh');
    },
  });
}
