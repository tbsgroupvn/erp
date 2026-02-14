'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { purchasesApi } from '@/lib/api/purchases.api';
import type {
  PurchaseQueryParams,
  CreatePurchaseRequestDto,
} from '@/lib/types/purchase.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const purchaseKeys = {
  all: ['purchases'] as const,
  requests: () => [...purchaseKeys.all, 'requests'] as const,
  requestList: (params?: PurchaseQueryParams) => [...purchaseKeys.requests(), params] as const,
  requestDetail: (id: string) => [...purchaseKeys.requests(), 'detail', id] as const,
  orders: () => [...purchaseKeys.all, 'orders'] as const,
  orderList: (params?: PurchaseQueryParams) => [...purchaseKeys.orders(), params] as const,
  orderDetail: (id: string) => [...purchaseKeys.orders(), 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePurchaseRequests(params?: PurchaseQueryParams) {
  return useQuery({
    queryKey: purchaseKeys.requestList(params),
    queryFn: () => purchasesApi.listRequests(params),
  });
}

export function usePurchaseRequest(id: string) {
  return useQuery({
    queryKey: purchaseKeys.requestDetail(id),
    queryFn: () => purchasesApi.getRequestById(id),
    enabled: !!id,
  });
}

export function usePurchaseOrders(params?: PurchaseQueryParams) {
  return useQuery({
    queryKey: purchaseKeys.orderList(params),
    queryFn: () => purchasesApi.listOrders(params),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseKeys.orderDetail(id),
    queryFn: () => purchasesApi.getOrderById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseRequestDto) => purchasesApi.createRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.requests() });
      toast.success('Tạo yêu cầu mua thành công');
    },
    onError: () => {
      toast.error('Không thể tạo yêu cầu mua');
    },
  });
}

export function useApprovePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasesApi.approveRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.requestDetail(id) });
      qc.invalidateQueries({ queryKey: purchaseKeys.requests() });
      toast.success('Duyệt yêu cầu mua thành công');
    },
    onError: () => {
      toast.error('Không thể duyệt yêu cầu mua');
    },
  });
}

export function useConvertToPO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasesApi.convertToPO(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.requestDetail(id) });
      qc.invalidateQueries({ queryKey: purchaseKeys.requests() });
      qc.invalidateQueries({ queryKey: purchaseKeys.orders() });
      toast.success('Chuyển đổi sang đơn mua hàng thành công');
    },
    onError: () => {
      toast.error('Không thể chuyển đổi sang đơn mua hàng');
    },
  });
}

export function useRecordReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasesApi.recordReceipt(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.orderDetail(id) });
      qc.invalidateQueries({ queryKey: purchaseKeys.orders() });
      toast.success('Ghi nhận nhập hàng thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận nhập hàng');
    },
  });
}
