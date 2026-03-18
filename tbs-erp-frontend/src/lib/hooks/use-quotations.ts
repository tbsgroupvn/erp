'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { quotationsApi } from '@/lib/api/quotations.api';
import type {
  QuotationQueryParams,
  CreateQuotationDto,
  CreateTemplateDto,
  SaveAsTemplateDto,
  CreateFromTemplateDto,
} from '@/lib/types';

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
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: quotationKeys.detail(id),
    queryFn: () => quotationsApi.getById(id),
    enabled: !!id,
    staleTime: 60 * 1000,
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
      toast.success('Đã sao chép báo giá');
    },
  });
}

// ---------------------------------------------------------------------------
// Template Queries & Mutations
// ---------------------------------------------------------------------------

export const templateKeys = {
  all: ['quotation-templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
};

export function useQuotationTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => quotationsApi.listTemplates(),
    staleTime: 5 * 60 * 1000, // templates are near-static
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateDto) => quotationsApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list() });
      toast.success('Đã tạo mẫu báo giá');
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list() });
      toast.success('Đã xóa mẫu');
    },
  });
}

export function useSaveAsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SaveAsTemplateDto }) =>
      quotationsApi.saveAsTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list() });
      toast.success('Đã lưu mẫu báo giá');
    },
  });
}

export function useCreateFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string;
      data: CreateFromTemplateDto;
    }) => quotationsApi.createFromTemplate(templateId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotationKeys.lists() });
      toast.success('Đã tạo báo giá từ mẫu');
    },
  });
}

// ---------------------------------------------------------------------------
// Recent Items
// ---------------------------------------------------------------------------

export function useRecentItemsForCustomer(customerId: string) {
  return useQuery({
    queryKey: ['quotation-recent-items', customerId],
    queryFn: () => quotationsApi.getRecentItems(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });
}
