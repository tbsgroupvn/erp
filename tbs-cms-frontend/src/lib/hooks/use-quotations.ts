'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { quotationsApi } from '@/lib/api/quotations.api';
import type { QuotationQueryParams, CreateQuotationDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const quotationKeys = {
  all: ['quotations'] as const,
  lists: () => [...quotationKeys.all, 'list'] as const,
  list: (params?: QuotationQueryParams) => [...quotationKeys.lists(), params] as const,
  details: () => [...quotationKeys.all, 'detail'] as const,
  detail: (id: string) => [...quotationKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useQuotations(params?: QuotationQueryParams) {
  return useQuery({
    queryKey: quotationKeys.list(params),
    queryFn: () => quotationsApi.list(params),
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: quotationKeys.detail(id),
    queryFn: () => quotationsApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuotationDto) => quotationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateQuotationDto> }) =>
      quotationsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: quotationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
      toast.success('Cập nhật báo giá thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật báo giá');
    },
  });
}

export function useApproveQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.approve(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: quotationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

export function useRejectQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      quotationsApi.reject(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: quotationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

export function useConvertQuotationToOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.convertToOrder(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: quotationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

export function useDuplicateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}
