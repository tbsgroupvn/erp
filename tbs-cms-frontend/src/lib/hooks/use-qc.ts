'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { qcApi } from '@/lib/api/qc.api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const qcKeys = {
  all: ['qc-inspections'] as const,
  lists: () => [...qcKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...qcKeys.lists(), params] as const,
  details: () => [...qcKeys.all, 'detail'] as const,
  detail: (id: string) => [...qcKeys.details(), id] as const,
  statistics: (params?: Record<string, unknown>) => [...qcKeys.all, 'statistics', params] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useQCInspections(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: qcKeys.list(params),
    queryFn: () => qcApi.list(params),
  });
}

export function useQCInspection(id: string) {
  return useQuery({
    queryKey: qcKeys.detail(id),
    queryFn: () => qcApi.getById(id),
    enabled: !!id,
  });
}

export function useQCStatistics(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: qcKeys.statistics(params),
    queryFn: () => qcApi.getStatistics(params),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateQCInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => qcApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qcKeys.lists() });
      qc.invalidateQueries({ queryKey: qcKeys.statistics() });
      toast.success('Tạo phiếu QC thành công');
    },
    onError: () => {
      toast.error('Không thể tạo phiếu QC');
    },
  });
}

export function useStartQCInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => qcApi.startInspection(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: qcKeys.lists() });
      qc.invalidateQueries({ queryKey: qcKeys.statistics() });
      toast.success('Bắt đầu kiểm tra QC');
    },
    onError: () => {
      toast.error('Không thể bắt đầu kiểm tra');
    },
  });
}

export function useCompleteQCInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      qcApi.completeInspection(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: qcKeys.lists() });
      qc.invalidateQueries({ queryKey: qcKeys.statistics() });
      toast.success('Hoàn thành kiểm tra QC');
    },
    onError: () => {
      toast.error('Không thể hoàn thành kiểm tra');
    },
  });
}

export function useSendCustomerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => qcApi.sendCustomerReview(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: qcKeys.lists() });
      qc.invalidateQueries({ queryKey: qcKeys.statistics() });
      toast.success('Đã gửi cho khách hàng duyệt');
    },
    onError: () => {
      toast.error('Không thể gửi cho khách hàng');
    },
  });
}

export function useUploadQCPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      qcApi.uploadPhotos(id, formData),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: qcKeys.lists() });
      toast.success('Upload ảnh thành công');
    },
    onError: () => {
      toast.error('Không thể upload ảnh');
    },
  });
}
