'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supplierOrdersApi } from '@/lib/api/supplier-orders.api';
import { orderKeys } from '@/lib/hooks/use-orders';
import type {
  SupplierOrderQueryParams,
  CreateSupplierOrderDto,
  UpdateSupplierOrderDto,
  RecordReceivedDto,
  SupplierOrderStatus,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const supplierOrderKeys = {
  all: ['supplier-orders'] as const,
  lists: () => [...supplierOrderKeys.all, 'list'] as const,
  list: (params?: SupplierOrderQueryParams) => [...supplierOrderKeys.lists(), params] as const,
  details: () => [...supplierOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierOrderKeys.details(), id] as const,
  byOrder: (orderId: string) => [...supplierOrderKeys.all, 'by-order', orderId] as const,
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

export function useSupplierOrder(id: string) {
  return useQuery({
    queryKey: supplierOrderKeys.detail(id),
    queryFn: () => supplierOrdersApi.getById(id),
    enabled: !!id,
  });
}

export function useSupplierOrdersByOrder(orderId: string) {
  return useQuery({
    queryKey: supplierOrderKeys.byOrder(orderId),
    queryFn: () => supplierOrdersApi.getByOrderId(orderId),
    enabled: !!orderId,
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
      qc.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
      toast.success('Tạo đơn đặt NCC thành công');
    },
    onError: () => {
      toast.error('Không thể tạo đơn đặt NCC');
    },
  });
}

export function useUpdateSupplierOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierOrderDto; orderId: string }) =>
      supplierOrdersApi.update(id, data),
    onSuccess: (_data, { id, orderId }) => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.byOrder(orderId) });
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
      orderId: string;
    }) => supplierOrdersApi.changeStatus(id, status, note),
    onSuccess: (_data, { id, orderId }) => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Cập nhật trạng thái NCC thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}

export function useRecordReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: RecordReceivedDto;
      orderId: string;
    }) => supplierOrdersApi.recordReceived(id, data),
    onSuccess: (_data, { id, orderId }) => {
      qc.invalidateQueries({ queryKey: supplierOrderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierOrderKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Ghi nhận hàng nhập kho TQ thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận nhập kho');
    },
  });
}
