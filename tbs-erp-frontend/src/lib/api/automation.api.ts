import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  AutomationRule,
  AutomationExecution,
  AutomationStats,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@/lib/types/automation.types';

export const automationApi = {
  /** GET /automation */
  list: () =>
    apiClient
      .get<BaseResponse<AutomationRule[]>>('/automation')
      .then((r) => r.data.data),

  /** GET /automation/stats */
  getStats: () =>
    apiClient
      .get<BaseResponse<AutomationStats>>('/automation/stats')
      .then((r) => r.data.data),

  /** POST /automation */
  create: (dto: CreateAutomationRuleDto) =>
    apiClient
      .post<BaseResponse<AutomationRule>>('/automation', dto)
      .then((r) => r.data.data),

  /** GET /automation/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<AutomationRule>>(`/automation/${id}`)
      .then((r) => r.data.data),

  /** PATCH /automation/:id */
  update: (id: string, dto: UpdateAutomationRuleDto) =>
    apiClient
      .patch<BaseResponse<AutomationRule>>(`/automation/${id}`, dto)
      .then((r) => r.data.data),

  /** DELETE /automation/:id */
  delete: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean; id: string }>>(`/automation/${id}`)
      .then((r) => r.data.data),

  /** POST /automation/:id/test */
  test: (id: string) =>
    apiClient
      .post<BaseResponse<{ status: string; durationMs: number; errorMsg?: string }>>(
        `/automation/${id}/test`,
      )
      .then((r) => r.data.data),

  /** GET /automation/:id/executions */
  getExecutions: (id: string, limit = 50) =>
    apiClient
      .get<BaseResponse<AutomationExecution[]>>(
        `/automation/${id}/executions`,
        { params: { limit } },
      )
      .then((r) => r.data.data),
};
