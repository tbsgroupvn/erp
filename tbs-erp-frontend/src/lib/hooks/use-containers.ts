'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { containersApi } from '@/lib/api/containers.api';
import type {
  ContainerQueryParams,
  CreateContainerDto,
  Container,
  RecordDeliveryOrderDto,
  UpdateFreeTimeDto,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const containerKeys = {
  all: ['containers'] as const,
  lists: () => [...containerKeys.all, 'list'] as const,
  list: (params?: ContainerQueryParams) =>
    [...containerKeys.lists(), params] as const,
  details: () => [...containerKeys.all, 'detail'] as const,
  detail: (id: string) => [...containerKeys.details(), id] as const,
  consolidation: () => [...containerKeys.all, 'consolidation'] as const,
  timeline: (id: string) => [...containerKeys.all, 'timeline', id] as const,
  costBreakdown: (id: string) => [...containerKeys.all, 'costs', id] as const,
  weightReconciliation: (id: string) => [...containerKeys.all, 'weight', id] as const,
  customsSplit: (id: string) => [...containerKeys.all, 'customs-split', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useContainers(params?: ContainerQueryParams) {
  return useQuery({
    queryKey: containerKeys.list(params),
    queryFn: () => containersApi.list(params),
  });
}

export function useContainer(id: string) {
  return useQuery({
    queryKey: containerKeys.detail(id),
    queryFn: () => containersApi.getById(id),
    enabled: !!id,
  });
}

export function useConsolidationPlan() {
  return useQuery({
    queryKey: containerKeys.consolidation(),
    queryFn: () => containersApi.getConsolidationPlan(),
  });
}

/** Fetch open containers (PLANNING + LOADING) for package consolidation */
export function useOpenContainers(shippingRoute?: string) {
  return useQuery({
    queryKey: [...containerKeys.all, 'open', shippingRoute] as const,
    queryFn: async () => {
      const [planning, loading] = await Promise.all([
        containersApi.list({ status: 'PLANNING' satisfies Container['status'], limit: 50 }),
        containersApi.list({ status: 'LOADING' satisfies Container['status'], limit: 50 }),
      ]);
      const all = [...(planning?.data ?? []), ...(loading?.data ?? [])];
      if (shippingRoute) {
        return all.filter((c) => c.shippingRoute === shippingRoute);
      }
      return all;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContainerDto) => containersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: containerKeys.lists() });
      toast.success('Tạo container thành công');
    },
    onError: () => {
      toast.error('Không thể tạo container');
    },
  });
}

export function useAddPackages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, packageIds }: { id: string; packageIds: string[] }) =>
      containersApi.addPackages(id, packageIds),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: containerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: containerKeys.lists() });
      qc.invalidateQueries({ queryKey: containerKeys.consolidation() });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Da them kien hang vao container');
    },
    onError: () => {
      toast.error('Khong the them kien hang');
    },
  });
}

export function useUpdateContainerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Container['status'] }) =>
      containersApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: containerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: containerKeys.timeline(id) });
      qc.invalidateQueries({ queryKey: containerKeys.lists() });
      toast.success('Cập nhật trạng thái container thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}

// ---------------------------------------------------------------------------
// New analytics queries
// ---------------------------------------------------------------------------

export function useContainerTimeline(id: string) {
  return useQuery({
    queryKey: containerKeys.timeline(id),
    queryFn: () => containersApi.getTimeline(id),
    enabled: !!id,
  });
}

export function useContainerCostBreakdown(id: string) {
  return useQuery({
    queryKey: containerKeys.costBreakdown(id),
    queryFn: () => containersApi.getCostBreakdown(id),
    enabled: !!id,
  });
}

export function useContainerWeightReconciliation(id: string) {
  return useQuery({
    queryKey: containerKeys.weightReconciliation(id),
    queryFn: () => containersApi.getWeightReconciliation(id),
    enabled: !!id,
  });
}

export function useContainerCustomsSplitStatus(id: string, enabled = true) {
  return useQuery({
    queryKey: containerKeys.customsSplit(id),
    queryFn: () => containersApi.getCustomsSplitStatus(id),
    enabled: !!id && enabled,
  });
}

// ---------------------------------------------------------------------------
// New mutations
// ---------------------------------------------------------------------------

export function useRecordDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordDeliveryOrderDto }) =>
      containersApi.recordDeliveryOrder(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: containerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: containerKeys.timeline(id) });
      toast.success('Đã ghi nhận lệnh giao hàng (D/O)');
    },
    onError: () => {
      toast.error('Không thể ghi nhận D/O');
    },
  });
}

export function useUpdateFreeTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFreeTimeDto }) =>
      containersApi.updateFreeTime(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: containerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: containerKeys.timeline(id) });
      toast.success('Đã cập nhật hạn miễn phí lưu cont');
    },
    onError: () => {
      toast.error('Không thể cập nhật free time');
    },
  });
}
