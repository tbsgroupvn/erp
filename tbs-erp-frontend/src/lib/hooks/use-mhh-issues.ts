'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mhhIssuesApi, mhhPriceApi } from '@/lib/api/mhh-issues.api';
import { orderKeys } from '@/lib/hooks/use-orders';
import type {
  CreateMHHIssueDto,
  ResolveMHHIssueDto,
  MHHIssueStatus,
  MHHPriceCalculateDto,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const mhhIssueKeys = {
  all: ['mhh-issues'] as const,
  detail: (id: string) => [...mhhIssueKeys.all, 'detail', id] as const,
  byOrder: (orderId: string) => [...mhhIssueKeys.all, 'by-order', orderId] as const,
};

export const mhhPriceKeys = {
  all: ['mhh-price'] as const,
  calculate: (params: MHHPriceCalculateDto) => [...mhhPriceKeys.all, params] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMHHIssue(issueId: string) {
  return useQuery({
    queryKey: mhhIssueKeys.detail(issueId),
    queryFn: () => mhhIssuesApi.getById(issueId),
    enabled: !!issueId,
    staleTime: 30 * 1000,
  });
}

export function useMHHIssuesByOrder(orderId: string) {
  return useQuery({
    queryKey: mhhIssueKeys.byOrder(orderId),
    queryFn: () => mhhIssuesApi.getByOrderId(orderId),
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });
}

export function useMHHPriceCalculation(params: MHHPriceCalculateDto | null) {
  return useQuery({
    queryKey: mhhPriceKeys.calculate(params!),
    queryFn: () => mhhPriceApi.calculate(params!),
    enabled: !!params && params.productPriceCNY > 0 && params.quantity > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateMHHIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: Omit<CreateMHHIssueDto, 'orderId'>;
    }) => mhhIssuesApi.create(orderId, data),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: mhhIssueKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Tạo vấn đề MHH thành công');
    },
  });
}

export function useUpdateMHHIssueStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      status,
      note,
    }: {
      issueId: string;
      status: MHHIssueStatus;
      note?: string;
      orderId: string;
    }) => mhhIssuesApi.updateStatus(issueId, status, note),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: mhhIssueKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Cập nhật trạng thái vấn đề thành công');
    },
  });
}

export function useResolveMHHIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      data,
    }: {
      issueId: string;
      data: ResolveMHHIssueDto;
      orderId: string;
    }) => mhhIssuesApi.resolve(issueId, data),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: mhhIssueKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Giải quyết vấn đề MHH thành công');
    },
  });
}

export function useAssignMHHIssueHandler() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      handlerId,
    }: {
      issueId: string;
      handlerId: string;
      orderId: string;
    }) => mhhIssuesApi.assignHandler(issueId, handlerId),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: mhhIssueKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Phân công xử lý thành công');
    },
  });
}

export function useRecordCustomerDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      decision,
      customerNote,
    }: {
      issueId: string;
      decision: string;
      customerNote?: string;
      orderId: string;
    }) => mhhIssuesApi.recordCustomerDecision(issueId, decision, customerNote),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: mhhIssueKeys.byOrder(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success('Ghi nhận quyết định khách hàng thành công');
    },
  });
}

export function useCalculateMHHPrice() {
  return useMutation({
    mutationFn: (data: MHHPriceCalculateDto) => mhhPriceApi.calculate(data),
  });
}
