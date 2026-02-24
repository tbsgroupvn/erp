'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { warehouseCnApi } from '@/lib/api/warehouse-cn.api';
import { warehouseVnApi } from '@/lib/api/warehouse-vn.api';
import { containersApi } from '@/lib/api/containers.api';
import type {
  ContainerQueryParams,
  QueryParams,
  ReceivePackageDto,
  MeasurePackageDto,
  WarehouseCNStatus,
  WarehouseVNStatus,
  DispatchDto,
  CreateContainerDto,
  Container,
  Branch,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const warehouseKeys = {
  cnPackages: (params?: QueryParams) => ['packages-cn', params] as const,
  cnPackage: (id: string) => ['packages-cn', 'detail', id] as const,
  vnPackages: (params?: QueryParams) => ['packages-vn', params] as const,
  containers: (params?: ContainerQueryParams) => ['containers', params] as const,
  container: (id: string) => ['containers', 'detail', id] as const,
  deliveryPlan: (branch: Branch) => ['delivery-plan', branch] as const,
};

// ---------------------------------------------------------------------------
// CN Queries
// ---------------------------------------------------------------------------

export function usePackagesCN(params?: QueryParams) {
  return useQuery({
    queryKey: warehouseKeys.cnPackages(params),
    queryFn: () => warehouseCnApi.listPackages(params),
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
// VN Queries
// ---------------------------------------------------------------------------

export function usePackagesVN(params?: QueryParams) {
  return useQuery({
    queryKey: warehouseKeys.vnPackages(params),
    queryFn: () => warehouseVnApi.listPackages(params),
  });
}

// ---------------------------------------------------------------------------
// Container Queries
// ---------------------------------------------------------------------------

export function useContainers(params?: ContainerQueryParams) {
  return useQuery({
    queryKey: warehouseKeys.containers(params),
    queryFn: () => containersApi.list(params),
  });
}

export function useContainer(id: string) {
  return useQuery({
    queryKey: warehouseKeys.container(id),
    queryFn: () => containersApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Delivery Plan Query
// ---------------------------------------------------------------------------

export function useDeliveryPlan(branch: Branch) {
  return useQuery({
    queryKey: warehouseKeys.deliveryPlan(branch),
    queryFn: () => warehouseVnApi.getDeliveryPlan(branch),
    enabled: !!branch,
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
      toast.success('Nhận kiện hàng thành công');
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
// VN Mutations
// ---------------------------------------------------------------------------

export function useReceiveFromContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { containerId: string; packageIds: string[]; notes?: string }) =>
      warehouseVnApi.receiveFromContainer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-vn'] });
      qc.invalidateQueries({ queryKey: ['containers'] });
      toast.success('Nhận kiện từ container thành công');
    },
    onError: () => {
      toast.error('Không thể nhận kiện từ container');
    },
  });
}

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

export function useDispatchDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DispatchDto) => warehouseVnApi.dispatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-vn'] });
      qc.invalidateQueries({ queryKey: ['delivery-plan'] });
      toast.success('Tạo chuyến giao thành công');
    },
    onError: () => {
      toast.error('Không thể tạo chuyến giao');
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
      data: { receivedBy: string; signature?: string; notes?: string; photos?: string[] };
    }) => warehouseVnApi.confirmDelivery(deliveryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages-vn'] });
      toast.success('Xác nhận giao hàng thành công');
    },
    onError: () => {
      toast.error('Không thể xác nhận giao hàng');
    },
  });
}

// ---------------------------------------------------------------------------
// Container Mutations
// ---------------------------------------------------------------------------

export function useCreateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContainerDto) => containersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
      toast.success('Tạo container thành công');
    },
    onError: () => {
      toast.error('Không thể tạo container');
    },
  });
}

export function useAddPackagesToContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, packageIds }: { id: string; packageIds: string[] }) =>
      containersApi.addPackages(id, packageIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
      qc.invalidateQueries({ queryKey: ['packages-cn'] });
      toast.success('Thêm kiện vào container thành công');
    },
    onError: () => {
      toast.error('Không thể thêm kiện vào container');
    },
  });
}

export function useUpdateContainerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Container['status'] }) =>
      containersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] });
      toast.success('Cập nhật trạng thái container thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}
