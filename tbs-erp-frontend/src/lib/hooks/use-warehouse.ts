'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehouseApi } from '@/lib/api/warehouse';
import { warehouseCnApi } from '@/lib/api/warehouse-cn.api';
import { warehouseVnApi } from '@/lib/api/warehouse-vn.api';
import { containersApi } from '@/lib/api/containers.api';
import type {
  QueryParams,
  ReceivePackageDto,
  MeasurePackageDto,
  WarehouseCNStatus,
  WarehouseVNStatus,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const warehouseKeys = {
  cnPackages: (params?: QueryParams) => ['packages-cn', params] as const,
  cnPackage: (id: string) => ['packages-cn', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// CN Queries
// ---------------------------------------------------------------------------

export function usePackagesCN(params?: QueryParams) {
  return useQuery({
    queryKey: warehouseKeys.cnPackages(params),
    queryFn: () => warehouseApi.listPackagesCN(params).then((r) => r.data),
  });
}

export function usePackageCN(id: string) {
  return useQuery({
    queryKey: warehouseKeys.cnPackage(id),
    queryFn: () => warehouseCnApi.getPackage(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// CN Mutations
// ---------------------------------------------------------------------------

export function useReceivePackageCN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReceivePackageDto) => warehouseCnApi.receive(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-cn'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['containers'] });
      toast.success('Nhận kiện hàng thành công', {
        description: 'Don hang se tu dong chuyen trang thai neu day la kien dau tien.',
      });
    },
    onError: () => {
      toast.error('Không thể nhận kiện hàng');
    },
  });
}

export function useMeasurePackageCN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MeasurePackageDto }) =>
      warehouseCnApi.measure(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-cn'] });
      toast.success('Cập nhật kích thước thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật kích thước');
    },
  });
}

export function useUpdateCNStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WarehouseCNStatus }) =>
      warehouseCnApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-cn'] });
      toast.success('Cập nhật trạng thái thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}

// ---------------------------------------------------------------------------
// VN Mutations (unique to this file)
// ---------------------------------------------------------------------------

export function useSortPackagesVN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: WarehouseVNStatus }) =>
      warehouseVnApi.sortPackages(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-vn'] });
      toast.success('Phân loại kiện hàng thành công');
    },
    onError: () => {
      toast.error('Không thể phân loại kiện hàng');
    },
  });
}

// ---------------------------------------------------------------------------
// Container Mutations (unique to this file)
// ---------------------------------------------------------------------------

export function useAddPackagesToContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, packageIds }: { id: string; packageIds: string[] }) =>
      containersApi.addPackages(id, packageIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
      qc.invalidateQueries({ queryKey: ['packages-cn'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Them kien vao container thanh cong');
    },
    onError: () => {
      toast.error('Khong the them kien vao container');
    },
  });
}
