import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

export interface ApprovalTemplate {
  id: string;
  slug: string;
  name: string;
  nameVi: string;
  description: string | null;
  category: 'SALES' | 'FINANCE' | 'LOGISTICS' | 'HR';
  triggerType: string;
  nodesJson: unknown;
  edgesJson: unknown;
  isDefault: boolean;
  isInstalled?: boolean;
  createdAt: string;
}

export const approvalTemplatesApi = {
  /** GET /approval-templates */
  list: (category?: string) =>
    apiClient
      .get<BaseResponse<ApprovalTemplate[]>>('/approval-templates', {
        params: category ? { category } : undefined,
      })
      .then((r) => r.data.data),

  /** GET /approval-templates/:slug */
  get: (slug: string) =>
    apiClient
      .get<BaseResponse<ApprovalTemplate>>(`/approval-templates/${slug}`)
      .then((r) => r.data.data),

  /** POST /approval-templates/:slug/install */
  install: (slug: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/approval-templates/${slug}/install`)
      .then((r) => r.data.data),
};
