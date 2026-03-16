'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contractsApi } from '@/lib/api/contracts.api';
import type {
  ContractQueryParams,
  CreateContractDto,
  UpdateContractDto,
  ContractStatus,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params?: ContractQueryParams) => [...contractKeys.lists(), params] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useContracts(params?: ContractQueryParams) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => contractsApi.list(params),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContractDto) => contractsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      toast.success('Tạo hợp đồng thành công');
    },
    onError: () => {
      toast.error('Không thể tạo hợp đồng');
    },
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractDto }) =>
      contractsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: contractKeys.detail(id) });
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      toast.success('Cập nhật hợp đồng thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật hợp đồng');
    },
  });
}

export function useUpdateContractStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContractStatus }) =>
      contractsApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: contractKeys.detail(id) });
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      toast.success('Cập nhật trạng thái hợp đồng thành công');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Không thể cập nhật trạng thái');
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.lists() });
      toast.success('Đã xóa hợp đồng');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Không thể xóa hợp đồng');
    },
  });
}
