'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orderTemplatesApi } from '@/lib/api/order-templates.api';
import type {
  OrderTemplateQueryParams,
  CreateOrderTemplateDto,
  UpdateOrderTemplateDto,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const orderTemplateKeys = {
  all: ['order-templates'] as const,
  lists: () => [...orderTemplateKeys.all, 'list'] as const,
  list: (params?: OrderTemplateQueryParams) =>
    [...orderTemplateKeys.lists(), params] as const,
  details: () => [...orderTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderTemplateKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOrderTemplates(params?: OrderTemplateQueryParams) {
  return useQuery({
    queryKey: orderTemplateKeys.list(params),
    queryFn: () => orderTemplatesApi.list(params),
    staleTime: 5 * 60 * 1000, // templates are near-static
    placeholderData: keepPreviousData,
  });
}

export function useOrderTemplate(id: string) {
  return useQuery({
    queryKey: orderTemplateKeys.detail(id),
    queryFn: () => orderTemplatesApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderTemplateDto) =>
      orderTemplatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderTemplateKeys.lists() });
      toast.success('Tạo template thành công');
    },
  });
}

export function useUpdateOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderTemplateDto }) =>
      orderTemplatesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderTemplateKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderTemplateKeys.lists() });
      toast.success('Cập nhật template thành công');
    },
  });
}

export function useDeleteOrderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderTemplateKeys.lists() });
      toast.success('Xóa template thành công');
    },
  });
}
