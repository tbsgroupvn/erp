'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsApi.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
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
  });
}
