'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supplierOrdersApi } from '@/lib/api/supplier-orders.api';
import type {
  SupplierOrderStatus,
  CreateSupplierOrderDto,
  UpdateSupplierOrderDto,
  SupplierOrderQueryParams,
} from '@/lib/types/supplier-order.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const supplierOrderKeys = {
  all: ['supplier-orders'] as const,
  lists: () => [...supplierOrderKeys.all, 'list'] as const,
  list: (params?: SupplierOrderQueryParams) => [...supplierOrderKeys.lists(), params] as const,
  byOrder: (orderId: string) => [...supplierOrderKeys.all, 'by-order', orderId] as const,
  details: () => [...supplierOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierOrderKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useSupplierOrders(params?: SupplierOrderQueryParams) {
  return useQuery({
    queryKey: supplierOrderKeys.list(params),
    queryFn: () => supplierOrdersApi.list(params),
  });
}

export function useSupplierOrdersByOrder(orderId: string) {
  return useQuery({
    queryKey: supplierOrderKeys.byOrder(orderId),
    queryFn: () => supplierOrdersApi.listByOrder(orderId),
    enabled: !!orderId,
  });
}

export function useSupplierOrder(id: string) {
  return useQuery({
    queryKey: supplierOrderKeys.detail(id),
    queryFn: () => supplierOrdersApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateSupplierOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierOrderDto) => supplierOrdersApi.create(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.byOrder(variables.orderId) });
      toast.success('Tạo đơn NCC thành công');
    },
    onError: () => {
      toast.error('Không thể tạo đơn NCC');
    },
  });
}

export function useUpdateSupplierOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierOrderDto }) =>
      supplierOrdersApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
      toast.success('Cập nhật đơn NCC thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật đơn NCC');
    },
  });
}

export function useChangeSupplierOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: SupplierOrderStatus;
      note?: string;
    }) => supplierOrdersApi.changeStatus(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.all });
      toast.success('Cập nhật trạng thái thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}
