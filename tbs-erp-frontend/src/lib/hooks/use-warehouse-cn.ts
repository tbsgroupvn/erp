'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  warehouseCnApi,
  type CnPackageQueryParams,
} from '@/lib/api/warehouse-cn.api';
import type { ReceivePackageDto, MeasurePackageDto, WarehouseCNStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const cnPackageKeys = {
  all: ['cn-packages'] as const,
  lists: () => [...cnPackageKeys.all, 'list'] as const,
  list: (params?: CnPackageQueryParams) =>
    [...cnPackageKeys.lists(), params] as const,
  details: () => [...cnPackageKeys.all, 'detail'] as const,
  detail: (id: string) => [...cnPackageKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCnPackages(params?: CnPackageQueryParams) {
  return useQuery({
    queryKey: cnPackageKeys.list(params),
    queryFn: () => warehouseCnApi.listPackages(params),
  });
}

export function useCnPackage(id: string) {
  return useQuery({
    queryKey: cnPackageKeys.detail(id),
    queryFn: () => warehouseCnApi.getPackage(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useReceivePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReceivePackageDto) => warehouseCnApi.receive(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cnPackageKeys.lists() });
      toast.success('Nhận kiện hàng thành công');
    },
    onError: () => {
      toast.error('Không thể nhận kiện hàng');
    },
  });
}

export function useMeasurePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      packageId,
      data,
    }: {
      packageId: string;
      data: MeasurePackageDto;
    }) => warehouseCnApi.measure(packageId, data),
    onSuccess: (_data, { packageId }) => {
      qc.invalidateQueries({ queryKey: cnPackageKeys.detail(packageId) });
      qc.invalidateQueries({ queryKey: cnPackageKeys.lists() });
      toast.success('Đo kiện hàng thành công');
    },
    onError: () => {
      toast.error('Không thể đo kiện hàng');
    },
  });
}
