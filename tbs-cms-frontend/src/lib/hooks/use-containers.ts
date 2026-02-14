'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { containersApi } from '@/lib/api/containers.api';
import type {
  ContainerQueryParams,
  CreateContainerDto,
  Container,
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
  consolidation: (route: string) =>
    [...containerKeys.all, 'consolidation', route] as const,
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
      toast.success('Đã thêm kiện hàng vào container');
    },
    onError: () => {
      toast.error('Không thể thêm kiện hàng');
    },
  });
}

export function useUpdateContainerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Container['status'];
    }) => containersApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: containerKeys.detail(id) });
      qc.invalidateQueries({ queryKey: containerKeys.lists() });
      toast.success('Cập nhật trạng thái container thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}
