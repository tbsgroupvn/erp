'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { vendorsApi } from '@/lib/api/vendors.api';
import type {
  VendorQueryParams,
  CreateVendorDto,
  UpdateVendorDto,
  RateVendorDto,
} from '@/lib/types/vendor.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (params?: VendorQueryParams) => [...vendorKeys.lists(), params] as const,
  details: () => [...vendorKeys.all, 'detail'] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVendors(params?: VendorQueryParams) {
  return useQuery({
    queryKey: vendorKeys.list(params),
    queryFn: () => vendorsApi.list(params),
    staleTime: 5 * 60 * 1000, // vendor list is near-static
    placeholderData: keepPreviousData,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => vendorsApi.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVendorDto) => vendorsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success('Tạo nhà cung cấp thành công');
    },
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVendorDto }) =>
      vendorsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.detail(id) });
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success('Cập nhật nhà cung cấp thành công');
    },
  });
}

export function useToggleVendorApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      vendorsApi.toggleApproval(id, isApproved),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.detail(id) });
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success('Cập nhật trạng thái duyệt thành công');
    },
  });
}

export function useRateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RateVendorDto }) =>
      vendorsApi.rate(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.detail(id) });
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success('Đánh giá nhà cung cấp thành công');
    },
  });
}
