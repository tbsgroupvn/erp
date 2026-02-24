import { apiClient } from './client';
import type {
  BaseResponse,
  MHHIssue,
  CreateMHHIssueDto,
  ResolveMHHIssueDto,
  MHHIssueStatus,
  MHHPriceCalculateDto,
  MHHPriceResult,
} from '@/lib/types';

export const mhhIssuesApi = {
  /** POST /orders/:orderId/mhh-issues */
  create: (orderId: string, data: Omit<CreateMHHIssueDto, 'orderId'>) =>
    apiClient
      .post<BaseResponse<MHHIssue>>(`/orders/${orderId}/mhh-issues`, data)
      .then((r) => r.data.data),

  /** GET /orders/:orderId/mhh-issues */
  getByOrderId: (orderId: string) =>
    apiClient
      .get<BaseResponse<MHHIssue[]>>(`/orders/${orderId}/mhh-issues`)
      .then((r) => r.data.data),

  /** GET /orders/mhh-issues/:issueId */
  getById: (issueId: string) =>
    apiClient
      .get<BaseResponse<MHHIssue>>(`/orders/mhh-issues/${issueId}`)
      .then((r) => r.data.data),

  /** PATCH /orders/mhh-issues/:issueId/status */
  updateStatus: (issueId: string, status: MHHIssueStatus, note?: string) =>
    apiClient
      .patch<BaseResponse<MHHIssue>>(`/orders/mhh-issues/${issueId}/status`, { status, note })
      .then((r) => r.data.data),

  /** POST /orders/mhh-issues/:issueId/resolve */
  resolve: (issueId: string, data: ResolveMHHIssueDto) =>
    apiClient
      .post<BaseResponse<MHHIssue>>(`/orders/mhh-issues/${issueId}/resolve`, data)
      .then((r) => r.data.data),

  /** PATCH /orders/mhh-issues/:issueId/assign */
  assignHandler: (issueId: string, handlerId: string) =>
    apiClient
      .patch<BaseResponse<MHHIssue>>(`/orders/mhh-issues/${issueId}/assign`, { handlerId })
      .then((r) => r.data.data),

  /** POST /orders/mhh-issues/:issueId/customer-decision */
  recordCustomerDecision: (issueId: string, decision: string, customerNote?: string) =>
    apiClient
      .post<BaseResponse<MHHIssue>>(`/orders/mhh-issues/${issueId}/customer-decision`, {
        decision,
        customerNote,
      })
      .then((r) => r.data.data),
};

export const mhhPriceApi = {
  /** POST /orders/calculate-mhh-price */
  calculate: (data: MHHPriceCalculateDto) =>
    apiClient
      .post<BaseResponse<MHHPriceResult>>('/orders/calculate-mhh-price', data)
      .then((r) => r.data.data),
};
