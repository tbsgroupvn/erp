'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api/documents.api';
import type { DocumentQueryParams } from '@/lib/types/document.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (params?: DocumentQueryParams) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDocuments(params?: DocumentQueryParams) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentsApi.list(params),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => documentsApi.upload(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.lists() });
      toast.success('Tải tài liệu lên thành công');
    },
    onError: () => {
      toast.error('Không thể tải tài liệu lên');
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.lists() });
      toast.success('Đã xóa tài liệu');
    },
    onError: () => {
      toast.error('Không thể xóa tài liệu');
    },
  });
}
