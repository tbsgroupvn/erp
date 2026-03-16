'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers.api';
import type {
  CustomerQueryParams,
  CreateCustomerDto,
  UpdateCustomerDto,
  TopupWalletDto,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params?: CustomerQueryParams) =>
    [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  wallets: () => [...customerKeys.all, 'wallet'] as const,
  wallet: (id: string) => [...customerKeys.wallets(), id] as const,
  interactionNotes: (id: string) => [...customerKeys.all, 'interaction-notes', id] as const,
  analytics: (id: string) => [...customerKeys.all, 'analytics', id] as const,
  churnRiskList: (page: number, limit: number) =>
    [...customerKeys.all, 'churn-risk', page, limit] as const,
  trend: (id: string) => [...customerKeys.all, 'trend', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCustomers(params?: CustomerQueryParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customersApi.list(params),
  });
}

export function useCustomer(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersApi.getById(id),
    enabled: options?.enabled ?? !!id,
  });
}

export function useCustomerWallet(id: string) {
  return useQuery({
    queryKey: customerKeys.wallet(id),
    queryFn: () => customersApi.getWallet(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerDto) => customersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Tạo khách hàng thành công');
    },
    onError: () => {
      toast.error('Không thể tạo khách hàng');
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerDto }) =>
      customersApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success('Cập nhật khách hàng thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật khách hàng');
    },
  });
}

export function useInteractionNotes(customerId: string) {
  return useQuery({
    queryKey: customerKeys.interactionNotes(customerId),
    queryFn: () => customersApi.getInteractionNotes(customerId),
    enabled: !!customerId,
  });
}

export function useCreateInteractionNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: { content: string; channel: string } }) =>
      customersApi.createInteractionNote(customerId, data),
    onSuccess: (_data, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerKeys.interactionNotes(customerId) });
      toast.success('Lưu ghi chú thành công');
    },
    onError: () => {
      toast.error('Không thể lưu ghi chú');
    },
  });
}

export function useTopupWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Omit<TopupWalletDto, 'customerId'>;
    }) => customersApi.topupWallet(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customerKeys.wallet(id) });
      qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
      toast.success('Nạp ví thành công');
    },
    onError: () => {
      toast.error('Không thể nạp ví');
    },
  });
}

export function useCustomerAnalytics(customerId: string) {
  return useQuery({
    queryKey: customerKeys.analytics(customerId),
    queryFn: () => customersApi.getCustomerAnalytics(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000, // analytics are relatively stable — cache 5 min
  });
}

export function useChurnRiskList(page: number, limit: number) {
  return useQuery({
    queryKey: customerKeys.churnRiskList(page, limit),
    queryFn: () => customersApi.getChurnRiskList(page, limit),
    staleTime: 5 * 60 * 1000,
  });
}

/** Hook lay xu huong 12 thang cua mot khach hang */
export function useCustomerTrend(customerId: string) {
  return useQuery({
    queryKey: customerKeys.trend(customerId),
    queryFn: () => customersApi.getCustomerTrend(customerId),
    enabled: !!customerId,
    staleTime: 10 * 60 * 1000,
  });
}
