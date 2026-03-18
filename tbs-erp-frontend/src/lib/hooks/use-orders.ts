'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ordersApi, masterOrdersApi } from '@/lib/api/orders.api';
import type {
  OrderQueryParams,
  CreateOrderDto,
  UpdateOrderDto,
  OrderStatus,
  MasterOrderQueryParams,
  CreateMasterOrderDto,
  CreateSubOrderDto,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory — Orders
// ---------------------------------------------------------------------------
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params?: OrderQueryParams) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Query key factory — Master Orders
// ---------------------------------------------------------------------------
export const masterOrderKeys = {
  all: ['master-orders'] as const,
  lists: () => [...masterOrderKeys.all, 'list'] as const,
  list: (params?: MasterOrderQueryParams) => [...masterOrderKeys.lists(), params] as const,
  details: () => [...masterOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...masterOrderKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Order Queries
// ---------------------------------------------------------------------------

export function useOrders(params?: OrderQueryParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
    staleTime: 60 * 1000, // order lists — 1 min
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    staleTime: 30 * 1000, // order detail — 30s
  });
}

// ---------------------------------------------------------------------------
// Order Mutations
// ---------------------------------------------------------------------------

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderDto) => ordersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderDto }) =>
      ordersApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('Cập nhật đơn hàng thành công');
    },
  });
}

export function useChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: OrderStatus;
      note?: string;
    }) => ordersApi.changeStatus(id, status, note),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: masterOrderKeys.lists() });
      toast.success('Cập nhật trạng thái thành công');
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ordersApi.cancel(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: masterOrderKeys.lists() });
      toast.success('Đã hủy đơn hàng');
    },
  });
}

export function useReopenOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ordersApi.reopen(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: masterOrderKeys.lists() });
      toast.success('Đã mở lại đơn hàng thành công');
    },
  });
}

// ---------------------------------------------------------------------------
// Master Order Queries
// ---------------------------------------------------------------------------

export function useMasterOrders(params?: MasterOrderQueryParams) {
  return useQuery({
    queryKey: masterOrderKeys.list(params),
    queryFn: () => masterOrdersApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useMasterOrder(id: string) {
  return useQuery({
    queryKey: masterOrderKeys.detail(id),
    queryFn: () => masterOrdersApi.getById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Master Order Mutations
// ---------------------------------------------------------------------------

export function useCreateMasterOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMasterOrderDto) => masterOrdersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: masterOrderKeys.lists() });
    },
  });
}

export function useAddSubOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ masterOrderId, data }: { masterOrderId: string; data: CreateSubOrderDto }) =>
      masterOrdersApi.addSubOrder(masterOrderId, data),
    onSuccess: (_data, { masterOrderId }) => {
      qc.invalidateQueries({ queryKey: masterOrderKeys.detail(masterOrderId) });
      qc.invalidateQueries({ queryKey: masterOrderKeys.lists() });
      toast.success('Thêm đơn con thành công');
    },
  });
}
