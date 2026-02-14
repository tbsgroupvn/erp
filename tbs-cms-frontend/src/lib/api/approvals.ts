import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Approval,
  ProcessApprovalDto,
} from '@/lib/types';
import type { QueryParams } from '@/lib/types';

export const approvalsApi = {
  listPending(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Approval>>('/approvals/pending', { params });
  },
  process(id: string, dto: ProcessApprovalDto) {
    return apiClient.patch<BaseResponse<Approval>>(`/approvals/${id}/process`, dto);
  },
};
