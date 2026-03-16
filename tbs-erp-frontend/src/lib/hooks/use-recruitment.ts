'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  recruitmentApi,
  type CandidateQueryParams,
  type CreateCandidateDto,
  type UpdateCandidateDto,
  type UpdateCandidateStatusDto,
} from '@/lib/api/recruitment.api';

// ─── Query key factory ────────────────────────────────────────────────────────

export const recruitmentKeys = {
  all: ['recruitment'] as const,
  lists: () => [...recruitmentKeys.all, 'list'] as const,
  list: (params?: CandidateQueryParams) => [...recruitmentKeys.lists(), params] as const,
  details: () => [...recruitmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...recruitmentKeys.details(), id] as const,
  stats: () => [...recruitmentKeys.all, 'stats'] as const,
  board: (search?: string) => [...recruitmentKeys.all, 'board', search ?? ''] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useRecruitmentList(params?: CandidateQueryParams) {
  return useQuery({
    queryKey: recruitmentKeys.list(params),
    queryFn: () => recruitmentApi.list(params),
  });
}

export function useRecruitmentStats() {
  return useQuery({
    queryKey: recruitmentKeys.stats(),
    queryFn: () => recruitmentApi.getStats(),
    staleTime: 30 * 1000, // 30 giây
  });
}

export function useRecruitmentBoard(search?: string) {
  return useQuery({
    queryKey: recruitmentKeys.board(search),
    queryFn: () => recruitmentApi.getBoard(search),
    staleTime: 15 * 1000,
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: recruitmentKeys.detail(id),
    queryFn: () => recruitmentApi.getById(id),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCandidateDto) => recruitmentApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.all });
      toast.success('Thêm ứng viên thành công');
    },
    onError: () => {
      toast.error('Không thể thêm ứng viên');
    },
  });
}

export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCandidateDto }) =>
      recruitmentApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: recruitmentKeys.lists() });
      qc.invalidateQueries({ queryKey: recruitmentKeys.board() });
      toast.success('Cập nhật thông tin thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật thông tin');
    },
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCandidateStatusDto }) =>
      recruitmentApi.updateStatus(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: recruitmentKeys.board() });
      qc.invalidateQueries({ queryKey: recruitmentKeys.stats() });
      toast.success('Cập nhật trạng thái thành công');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Không thể cập nhật trạng thái';
      toast.error(msg);
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recruitmentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recruitmentKeys.all });
      toast.success('Đã xóa ứng viên');
    },
    onError: () => {
      toast.error('Không thể xóa ứng viên');
    },
  });
}
