'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  approvalsApi,
  type ApprovalQueryParams,
} from '@/lib/api/approvals.api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const approvalKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalKeys.all, 'list'] as const,
  list: (params?: ApprovalQueryParams) =>
    [...approvalKeys.lists(), params] as const,
  details: () => [...approvalKeys.all, 'detail'] as const,
  detail: (id: string) => [...approvalKeys.details(), id] as const,
  pending: () => [...approvalKeys.all, 'pending'] as const,
  history: () => [...approvalKeys.all, 'history'] as const,
  counts: () => [...approvalKeys.all, 'counts'] as const,
  submitted: (params?: ApprovalQueryParams) =>
    [...approvalKeys.all, 'submitted', params] as const,
  processed: (params?: ApprovalQueryParams) =>
    [...approvalKeys.all, 'processed', params] as const,
  cc: (params?: ApprovalQueryParams) =>
    [...approvalKeys.all, 'cc', params] as const,
  comments: (id: string) => [...approvalKeys.all, 'comments', id] as const,
  actionLog: (id: string) => [...approvalKeys.all, 'action-log', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useApprovals(params?: ApprovalQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.list(params),
    queryFn: () => approvalsApi.list(params),
    enabled: options?.enabled,
    staleTime: 30 * 1000, // approvals change frequently — 30s
    placeholderData: keepPreviousData,
  });
}

export function useApproval(id: string) {
  return useQuery({
    queryKey: approvalKeys.detail(id),
    queryFn: () => approvalsApi.getById(id),
    enabled: !!id,
  });
}

export function usePendingApprovals(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.pending(),
    queryFn: () => approvalsApi.getPending(),
    enabled: options?.enabled,
  });
}

export function useApprovalCounts() {
  return useQuery({
    queryKey: approvalKeys.counts(),
    queryFn: () => approvalsApi.getCounts(),
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 min
  });
}

export function useSubmittedApprovals(params?: ApprovalQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.submitted(params),
    queryFn: () => approvalsApi.getSubmitted(params),
    enabled: options?.enabled,
  });
}

export function useProcessedApprovals(params?: ApprovalQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.processed(params),
    queryFn: () => approvalsApi.getProcessed(params),
    enabled: options?.enabled,
  });
}

export function useCCApprovals(params?: ApprovalQueryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalKeys.cc(params),
    queryFn: () => approvalsApi.getCCApprovals(params),
    enabled: options?.enabled,
  });
}

export function useApprovalComments(id: string) {
  return useQuery({
    queryKey: approvalKeys.comments(id),
    queryFn: () => approvalsApi.getComments(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useApprovalActionLog(id: string) {
  return useQuery({
    queryKey: approvalKeys.actionLog(id),
    queryFn: () => approvalsApi.getActionLog(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function useInvalidateApproval() {
  const qc = useQueryClient();
  return (id?: string) => {
    if (id) qc.invalidateQueries({ queryKey: approvalKeys.detail(id) });
    qc.invalidateQueries({ queryKey: approvalKeys.lists() });
    qc.invalidateQueries({ queryKey: approvalKeys.pending() });
    qc.invalidateQueries({ queryKey: approvalKeys.counts() });
    qc.invalidateQueries({ queryKey: approvalKeys.submitted() });
    qc.invalidateQueries({ queryKey: approvalKeys.processed() });
    qc.invalidateQueries({ queryKey: approvalKeys.cc() });
  };
}

export function useApproveApproval() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approvalsApi.approve(id, comment),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã phê duyệt');
    },
  });
}

export function useRejectApproval() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      approvalsApi.reject(id, comment),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã từ chối');
    },
  });
}

export function useDelegateApproval() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({
      id,
      stepId,
      toUserId,
      comment,
    }: {
      id: string;
      stepId: string;
      toUserId: string;
      comment?: string;
    }) => approvalsApi.delegate(id, stepId, toUserId, comment),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã chuyển tiếp');
    },
  });
}

export function useAddApprover() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({
      id,
      afterStepNumber,
      role,
      userId,
    }: {
      id: string;
      afterStepNumber: number;
      role: string;
      userId?: string;
    }) => approvalsApi.addApprover(id, afterStepNumber, role, userId),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã thêm người duyệt');
    },
  });
}

export function useWithdrawApproval() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => approvalsApi.withdraw(id),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã rút lại yêu cầu');
    },
  });
}

export function useReturnApproval() {
  const invalidate = useInvalidateApproval();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      approvalsApi.returnForRevision(id, comment),
    onSuccess: (_data, { id }) => {
      invalidate(id);
      toast.success('Đã trả lại yêu cầu');
    },
  });
}

export function useAddApprovalComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      content,
      stepId,
    }: {
      id: string;
      content: string;
      stepId?: string;
    }) => approvalsApi.addComment(id, content, stepId),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: approvalKeys.comments(id) });
      qc.invalidateQueries({ queryKey: approvalKeys.detail(id) });
      toast.success('Đã thêm bình luận');
    },
  });
}
