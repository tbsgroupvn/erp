import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Approval,
  ApprovalComment,
  ApprovalActionLog,
  ApprovalCounts,
  QueryParams,
  ApprovalType,
  ApprovalStatus,
} from '@/lib/types';

export interface ApprovalQueryParams extends QueryParams {
  type?: ApprovalType;
  status?: ApprovalStatus;
}

export const approvalsApi = {
  /** GET /approvals */
  list: (params?: ApprovalQueryParams) =>
    apiClient
      .get<PaginatedResponse<Approval>>('/approvals', { params })
      .then((r) => r.data),

  /** GET /approvals/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Approval>>(`/approvals/${id}`)
      .then((r) => r.data.data),

  /** GET /approvals/pending */
  getPending: () =>
    apiClient
      .get<BaseResponse<{ data: Approval[]; total: number }>>('/approvals/pending')
      .then((r) => r.data.data),

  /** GET /approvals/history */
  getHistory: () =>
    apiClient
      .get<BaseResponse<{ data: Approval[]; total: number }>>('/approvals/history')
      .then((r) => r.data.data),

  /** GET /approvals/counts */
  getCounts: () =>
    apiClient
      .get<BaseResponse<ApprovalCounts>>('/approvals/counts')
      .then((r) => r.data.data),

  /** GET /approvals/submitted */
  getSubmitted: (params?: ApprovalQueryParams) =>
    apiClient
      .get<BaseResponse<{ data: Approval[]; total: number }>>('/approvals/submitted', { params })
      .then((r) => r.data.data),

  /** GET /approvals/processed */
  getProcessed: (params?: ApprovalQueryParams) =>
    apiClient
      .get<BaseResponse<{ data: Approval[]; total: number }>>('/approvals/processed', { params })
      .then((r) => r.data.data),

  /** GET /approvals/cc */
  getCCApprovals: (params?: ApprovalQueryParams) =>
    apiClient
      .get<BaseResponse<{ data: Approval[]; total: number }>>('/approvals/cc', { params })
      .then((r) => r.data.data),

  /** POST /approvals/:id/approve */
  approve: (id: string, comment?: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/approve`, {
        decision: 'APPROVE',
        comment,
      })
      .then((r) => r.data.data),

  /** POST /approvals/:id/reject */
  reject: (id: string, comment: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/reject`, {
        decision: 'REJECT',
        comment,
      })
      .then((r) => r.data.data),

  /** POST /approvals/:id/delegate */
  delegate: (id: string, stepId: string, toUserId: string, comment?: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/delegate`, {
        stepId,
        toUserId,
        comment,
      })
      .then((r) => r.data.data),

  /** POST /approvals/:id/add-approver */
  addApprover: (id: string, afterStepNumber: number, role: string, userId?: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/add-approver`, {
        afterStepNumber,
        role,
        userId,
      })
      .then((r) => r.data.data),

  /** POST /approvals/:id/withdraw */
  withdraw: (id: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/withdraw`)
      .then((r) => r.data.data),

  /** POST /approvals/:id/return */
  returnForRevision: (id: string, comment: string) =>
    apiClient
      .post<BaseResponse<Approval>>(`/approvals/${id}/return`, { comment })
      .then((r) => r.data.data),

  /** GET /approvals/:id/comments */
  getComments: (id: string) =>
    apiClient
      .get<BaseResponse<ApprovalComment[]>>(`/approvals/${id}/comments`)
      .then((r) => r.data.data),

  /** POST /approvals/:id/comments */
  addComment: (id: string, content: string, stepId?: string) =>
    apiClient
      .post<BaseResponse<ApprovalComment>>(`/approvals/${id}/comments`, {
        content,
        stepId,
      })
      .then((r) => r.data.data),

  /** GET /approvals/:id/action-log */
  getActionLog: (id: string) =>
    apiClient
      .get<BaseResponse<ApprovalActionLog[]>>(`/approvals/${id}/action-log`)
      .then((r) => r.data.data),

  /** POST /approvals/batch-approve */
  batchApprove: (approvalIds: string[], comment?: string) =>
    apiClient
      .post<BaseResponse<{ processed: number; failed: number }>>('/approvals/batch-approve', {
        approvalIds,
        comment,
      })
      .then((r) => r.data.data),

  /** POST /approvals/batch-reject */
  batchReject: (approvalIds: string[], comment?: string) =>
    apiClient
      .post<BaseResponse<{ processed: number; failed: number }>>('/approvals/batch-reject', {
        approvalIds,
        comment,
      })
      .then((r) => r.data.data),
};
