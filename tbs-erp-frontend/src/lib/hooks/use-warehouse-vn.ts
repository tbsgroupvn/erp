'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  warehouseVnApi,
  type VnPackageQueryParams,
} from '@/lib/api/warehouse-vn.api';
import type { DispatchDto, Branch, WarehouseVNStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const vnPackageKeys = {
  all: ['vn-packages'] as const,
  lists: () => [...vnPackageKeys.all, 'list'] as const,
  list: (params?: VnPackageQueryParams) =>
    [...vnPackageKeys.lists(), params] as const,
  deliveryPlan: (branch: Branch) =>
    [...vnPackageKeys.all, 'delivery-plan', branch] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVnPackages(params?: VnPackageQueryParams) {
  return useQuery({
    queryKey: vnPackageKeys.list(params),
    queryFn: () => warehouseVnApi.listPackages(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useDeliveryPlan(branch: Branch) {
  return useQuery({
    queryKey: vnPackageKeys.deliveryPlan(branch),
    queryFn: () => warehouseVnApi.getDeliveryPlan(branch),
    enabled: !!branch,
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useReceiveFromContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      containerId: string;
      packageIds: string[];
      notes?: string;
    }) => warehouseVnApi.receiveFromContainer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vnPackageKeys.lists() });
      toast.success('Nhận hàng từ container thành công');
    },
  });
}

export function useDispatchDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DispatchDto) => warehouseVnApi.dispatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vnPackageKeys.lists() });
      toast.success('Phát hàng thành công');
    },
  });
}

export function useConfirmDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      deliveryId,
      data,
    }: {
      deliveryId: string;
      data: {
        receivedBy: string;
        signature?: string;
        notes?: string;
        photos?: string[];
      };
    }) => warehouseVnApi.confirmDelivery(deliveryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vnPackageKeys.lists() });
      toast.success('Xác nhận giao hàng thành công');
    },
  });
}
