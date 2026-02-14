import { apiClient } from './client';
import type {
  BaseResponse,
  ApprovalFlowDefinition,
  ApprovalDelegation,
} from '@/lib/types';

// ============================================
// APPROVAL FLOW DEFINITIONS
// ============================================

export const approvalFlowsApi = {
  /** GET /approval-flows */
  list: () =>
    apiClient
      .get<BaseResponse<ApprovalFlowDefinition[]>>('/approval-flows')
      .then((r) => r.data.data),

  /** GET /approval-flows/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<ApprovalFlowDefinition>>(`/approval-flows/${id}`)
      .then((r) => r.data.data),

  /** POST /approval-flows */
  create: (data: {
    name: string;
    description?: string;
    category?: string;
    triggerType: string;
    isActive?: boolean;
    formSchema?: Record<string, unknown>;
    nodes: Array<{
      nodeKey: string;
      nodeType: string;
      label?: string;
      approverType?: string;
      approverRole?: string;
      approverUserId?: string;
      approvalMode?: string;
      conditionField?: string;
      conditionOperator?: string;
      conditionValue?: string;
      deadlineHours?: number;
      autoAction?: string;
      fieldPermissions?: Record<string, string>;
      positionX?: number;
      positionY?: number;
    }>;
    edges: Array<{
      sourceNodeKey: string;
      targetNodeKey: string;
      label?: string;
      conditionExpression?: string;
      sortOrder?: number;
    }>;
  }) =>
    apiClient
      .post<BaseResponse<ApprovalFlowDefinition>>('/approval-flows', data)
      .then((r) => r.data.data),

  /** PUT /approval-flows/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .put<BaseResponse<ApprovalFlowDefinition>>(`/approval-flows/${id}`, data)
      .then((r) => r.data.data),

  /** POST /approval-flows/:id/version */
  createVersion: (id: string) =>
    apiClient
      .post<BaseResponse<ApprovalFlowDefinition>>(`/approval-flows/${id}/version`)
      .then((r) => r.data.data),

  /** DELETE /approval-flows/:id */
  deactivate: (id: string) =>
    apiClient
      .delete<BaseResponse<ApprovalFlowDefinition>>(`/approval-flows/${id}`)
      .then((r) => r.data.data),

  /** POST /approval-flows/:id/test */
  testFlow: (id: string, requestData: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>(`/approval-flows/${id}/test`, { requestData })
      .then((r) => r.data.data),
};

// ============================================
// APPROVAL DELEGATIONS
// ============================================

export const approvalDelegationsApi = {
  /** GET /approval-delegations */
  list: () =>
    apiClient
      .get<BaseResponse<ApprovalDelegation[]>>('/approval-delegations')
      .then((r) => r.data.data),

  /** POST /approval-delegations */
  create: (data: {
    toUserId: string;
    startDate: string;
    endDate: string;
    approvalTypes?: string[];
    reason?: string;
  }) =>
    apiClient
      .post<BaseResponse<ApprovalDelegation>>('/approval-delegations', data)
      .then((r) => r.data.data),

  /** DELETE /approval-delegations/:id */
  deactivate: (id: string) =>
    apiClient
      .delete<BaseResponse<ApprovalDelegation>>(`/approval-delegations/${id}`)
      .then((r) => r.data.data),
};
