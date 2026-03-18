'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { complaintsApi } from '@/lib/api/complaints.api';
import type { ComplaintQueryParams, CreateComplaintDto, ResolveComplaintDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const complaintKeys = {
  all: ['complaints'] as const,
  lists: () => [...complaintKeys.all, 'list'] as const,
  list: (params?: ComplaintQueryParams) => [...complaintKeys.lists(), params] as const,
  details: () => [...complaintKeys.all, 'detail'] as const,
  detail: (id: string) => [...complaintKeys.details(), id] as const,
  statistics: () => [...complaintKeys.all, 'statistics'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useComplaints(params?: ComplaintQueryParams) {
  return useQuery({
    queryKey: complaintKeys.list(params),
    queryFn: () => complaintsApi.list(params as Record<string, unknown>),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useComplaint(id: string) {
  return useQuery({
    queryKey: complaintKeys.detail(id),
    queryFn: () => complaintsApi.getById(id),
    enabled: !!id,
  });
}

export function useComplaintStatistics(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: complaintKeys.statistics(),
    queryFn: () => complaintsApi.getStatistics(params),
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateComplaintDto) => complaintsApi.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: complaintKeys.lists() });
      qc.invalidateQueries({ queryKey: complaintKeys.statistics() });
      toast.success('Tạo khiếu nại thành công');
    },
  });
}

export function useResolveComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolveComplaintDto }) =>
      complaintsApi.resolve(id, data as unknown as Record<string, unknown>),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      qc.invalidateQueries({ queryKey: complaintKeys.lists() });
      qc.invalidateQueries({ queryKey: complaintKeys.statistics() });
      toast.success('Giải quyết khiếu nại thành công');
    },
  });
}

export function useAssignComplaintHandler() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, handlerId }: { id: string; handlerId: string }) =>
      complaintsApi.assignHandler(id, handlerId),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      qc.invalidateQueries({ queryKey: complaintKeys.lists() });
      toast.success('Gán người xử lý thành công');
    },
  });
}
