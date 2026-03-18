'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customsDeclarationApi } from '@/lib/api/customs-declaration.api';
import type {
  CustomsDeclaration,
  CustomsDeclarationLine,
  CustomsDeclarationQueryParams,
} from '@/lib/types/customs.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const customsDeclarationKeys = {
  all: ['customs-declarations'] as const,
  lists: () => [...customsDeclarationKeys.all, 'list'] as const,
  list: (params?: CustomsDeclarationQueryParams) =>
    [...customsDeclarationKeys.lists(), params] as const,
  details: () => [...customsDeclarationKeys.all, 'detail'] as const,
  detail: (id: string) => [...customsDeclarationKeys.details(), id] as const,
  hsCodes: () => [...customsDeclarationKeys.all, 'hs-codes'] as const,
  hsCodeSearch: (query: string) => [...customsDeclarationKeys.hsCodes(), 'search', query] as const,
  hsCodeSuggest: (productName: string) =>
    [...customsDeclarationKeys.hsCodes(), 'suggest', productName] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCustomsDeclarations(params?: CustomsDeclarationQueryParams) {
  return useQuery({
    queryKey: customsDeclarationKeys.list(params),
    queryFn: () => customsDeclarationApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCustomsDeclaration(id: string) {
  return useQuery({
    queryKey: customsDeclarationKeys.detail(id),
    queryFn: () => customsDeclarationApi.getById(id),
    enabled: !!id,
  });
}

export function useSearchHSCodes(query: string) {
  return useQuery({
    queryKey: customsDeclarationKeys.hsCodeSearch(query),
    queryFn: () => customsDeclarationApi.searchHSCodes(query),
    enabled: query.length > 1,
    staleTime: 5 * 60 * 1000, // HS codes are static reference data
  });
}

export function useSuggestHSCode(productName: string) {
  return useQuery({
    queryKey: customsDeclarationKeys.hsCodeSuggest(productName),
    queryFn: () => customsDeclarationApi.suggestHSCode(productName),
    enabled: !!productName,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (containerId: string) => customsDeclarationApi.createFromContainer(containerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.lists() });
      toast.success('Tạo tờ khai thành công');
    },
  });
}

export function useUpdateDeclarationHeader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomsDeclaration> }) =>
      customsDeclarationApi.updateHeader(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.lists() });
      toast.success('Cập nhật tờ khai thành công');
    },
  });
}

export function useUpdateDeclarationLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lineId,
      data,
      declarationId,
    }: {
      lineId: string;
      data: Partial<CustomsDeclarationLine>;
      declarationId: string;
    }) => customsDeclarationApi.updateLine(lineId, data),
    onSuccess: (_data, { declarationId }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(declarationId) });
      toast.success('Cập nhật dòng thành công');
    },
  });
}

export function useRemoveDeclarationLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lineId,
      declarationId,
    }: {
      lineId: string;
      declarationId: string;
    }) => customsDeclarationApi.removeLine(lineId),
    onSuccess: (_data, { declarationId }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(declarationId) });
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.lists() });
      toast.success('Xóa dòng thành công');
    },
  });
}

export function useUpdateDeclarationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      customsDeclarationApi.updateStatus(id, status, note),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.lists() });
      toast.success('Cập nhật trạng thái thành công');
    },
  });
}

export function useUpdateDeclarationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: string }) =>
      customsDeclarationApi.updateChannel(id, channel),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.lists() });
      toast.success('Phân luồng thành công');
    },
  });
}

export function useRecalculateTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customsDeclarationApi.recalculateTax(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      toast.success('Tính lại thuế thành công');
    },
  });
}

export function useAllocateTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) =>
      customsDeclarationApi.allocateTax(id, method),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      toast.success('Phân bổ thuế thành công');
    },
  });
}

export function useExportEcus5() {
  return useMutation({
    mutationFn: (id: string) => customsDeclarationApi.exportEcus5(id),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecus5-export.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất ECUS5 thành công');
    },
  });
}

export function useGroupByHs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customsDeclarationApi.groupByHs(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      toast.success('Gom nhóm theo HS thành công');
    },
  });
}

export function useGroupCustom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { lineIds: string[]; hsCode: string; description: string };
    }) => customsDeclarationApi.groupCustom(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      toast.success('Gom nhóm tùy chỉnh thành công');
    },
  });
}

export function useUngroupLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, declarationId }: { lineId: string; declarationId: string }) =>
      customsDeclarationApi.ungroupLine(lineId),
    onSuccess: (_data, { declarationId }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(declarationId) });
      toast.success('Tách nhóm thành công');
    },
  });
}

export function useCheckCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customsDeclarationApi.checkCompliance(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(id) });
      toast.success('Kiểm tra tuân thủ hoàn tất');
    },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, declarationId }: { alertId: string; declarationId: string }) =>
      customsDeclarationApi.acknowledgeAlert(alertId),
    onSuccess: (_data, { declarationId }) => {
      qc.invalidateQueries({ queryKey: customsDeclarationKeys.detail(declarationId) });
      toast.success('Đã xác nhận cảnh báo');
    },
  });
}
