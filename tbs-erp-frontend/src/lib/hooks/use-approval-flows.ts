'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  approvalFlowsApi,
  approvalDelegationsApi,
} from '@/lib/api/approval-flows.api';
import { approvalsApi } from '@/lib/api/approvals.api';
import { approvalKeys } from '@/lib/hooks/use-approvals';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const flowKeys = {
  all: ['approval-flows'] as const,
  lists: () => [...flowKeys.all, 'list'] as const,
  details: () => [...flowKeys.all, 'detail'] as const,
  detail: (id: string) => [...flowKeys.details(), id] as const,
};

export const delegationKeys = {
  all: ['approval-delegations'] as const,
  lists: () => [...delegationKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Flow Definition Queries
// ---------------------------------------------------------------------------

export function useApprovalFlows() {
  return useQuery({
    queryKey: flowKeys.lists(),
    queryFn: () => approvalFlowsApi.list(),
  });
}

export function useApprovalFlow(id: string) {
  return useQuery({
    queryKey: flowKeys.detail(id),
    queryFn: () => approvalFlowsApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Flow Definition Mutations
// ---------------------------------------------------------------------------

export function useCreateApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approvalFlowsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: flowKeys.lists() });
      toast.success('Đã tạo quy trình');
    },
    onError: () => {
      toast.error('Không thể tạo quy trình');
    },
  });
}

export function useUpdateApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      approvalFlowsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: flowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: flowKeys.lists() });
      toast.success('Đã cập nhật quy trình');
    },
    onError: () => {
      toast.error('Không thể cập nhật quy trình');
    },
  });
}

export function useDeactivateApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalFlowsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: flowKeys.lists() });
      toast.success('Đã vô hiệu hóa quy trình');
    },
    onError: () => {
      toast.error('Không thể vô hiệu hóa');
    },
  });
}

export function useTestApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      requestData,
    }: {
      id: string;
      requestData: Record<string, unknown>;
    }) => approvalFlowsApi.testFlow(id, requestData),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: flowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: flowKeys.lists() });
      toast.success('Test quy trình thành công');
    },
    onError: () => {
      toast.error('Không thể test quy trình');
    },
  });
}

// ---------------------------------------------------------------------------
// Delegation Queries & Mutations
// ---------------------------------------------------------------------------

export function useDelegations() {
  return useQuery({
    queryKey: delegationKeys.lists(),
    queryFn: () => approvalDelegationsApi.list(),
  });
}

export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approvalDelegationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: delegationKeys.lists() });
      toast.success('Đã tạo ủy quyền');
    },
    onError: () => {
      toast.error('Không thể tạo ủy quyền');
    },
  });
}

export function useDeactivateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalDelegationsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: delegationKeys.lists() });
      toast.success('Đã hủy ủy quyền');
    },
    onError: () => {
      toast.error('Không thể hủy ủy quyền');
    },
  });
}

// ---------------------------------------------------------------------------
// Batch Actions
// ---------------------------------------------------------------------------

export function useBatchApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalIds, comment }: { approvalIds: string[]; comment?: string }) =>
      approvalsApi.batchApprove(approvalIds, comment),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success(
        `Đã duyệt ${result?.processed ?? 0} yêu cầu${result?.failed ? `, ${result.failed} thất bại` : ''}`,
      );
    },
    onError: () => {
      toast.error('Không thể duyệt hàng loạt. Vui lòng thử lại sau.');
    },
  });
}

export function useBatchReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalIds, comment }: { approvalIds: string[]; comment?: string }) =>
      approvalsApi.batchReject(approvalIds, comment),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: approvalKeys.all });
      toast.success(
        `Đã từ chối ${result?.processed ?? 0} yêu cầu${result?.failed ? `, ${result.failed} thất bại` : ''}`,
      );
    },
    onError: () => {
      toast.error('Không thể từ chối hàng loạt. Vui lòng thử lại sau.');
    },
  });
}
