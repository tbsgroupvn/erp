import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  Objective,
  KeyResult,
  OKRTaskLink,
  OKRDashboard,
  ParentCandidate,
  CreateObjectiveDto,
  UpdateObjectiveDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
  CheckInDto,
  OKRQueryParams,
  OKRPeriod,
  OKRLevel,
} from '@/lib/types/okr.types';

export const okrApi = {
  // ---------------------------------------------------------------------------
  // Objectives
  // ---------------------------------------------------------------------------

  /** GET /okr/objectives */
  listObjectives: (params?: OKRQueryParams) =>
    apiClient
      .get<BaseResponse<Objective[]>>('/okr/objectives', { params })
      .then((r) => r.data.data ?? []),

  /** GET /okr/objectives/tree */
  getTree: (period?: OKRPeriod, year?: number) =>
    apiClient
      .get<BaseResponse<Objective[]>>('/okr/objectives/tree', {
        params: { period, year },
      })
      .then((r) => r.data.data ?? []),

  /** GET /okr/objectives/dashboard */
  getDashboard: () =>
    apiClient
      .get<BaseResponse<OKRDashboard>>('/okr/objectives/dashboard')
      .then((r) => r.data.data!),

  /** GET /okr/objectives/my */
  getMyOKRs: (period?: OKRPeriod, year?: number) =>
    apiClient
      .get<BaseResponse<Objective[]>>('/okr/objectives/my', {
        params: { period, year },
      })
      .then((r) => r.data.data ?? []),

  /** GET /okr/objectives/parent-candidates */
  getParentCandidates: (level: OKRLevel, period?: OKRPeriod, year?: number) =>
    apiClient
      .get<BaseResponse<ParentCandidate[]>>('/okr/objectives/parent-candidates', {
        params: { level, period, year },
      })
      .then((r) => r.data.data ?? []),

  /** GET /okr/objectives/:id */
  getObjectiveById: (id: string) =>
    apiClient
      .get<BaseResponse<Objective>>(`/okr/objectives/${id}`)
      .then((r) => r.data.data!),

  /** POST /okr/objectives */
  createObjective: (dto: CreateObjectiveDto) =>
    apiClient
      .post<BaseResponse<Objective>>('/okr/objectives', dto)
      .then((r) => r.data.data!),

  /** PATCH /okr/objectives/:id */
  updateObjective: (id: string, dto: UpdateObjectiveDto) =>
    apiClient
      .patch<BaseResponse<Objective>>(`/okr/objectives/${id}`, dto)
      .then((r) => r.data.data!),

  /** DELETE /okr/objectives/:id */
  deleteObjective: (id: string) =>
    apiClient
      .delete<BaseResponse<{ success: boolean }>>(`/okr/objectives/${id}`)
      .then((r) => r.data.data!),

  // ---------------------------------------------------------------------------
  // Key Results
  // ---------------------------------------------------------------------------

  /** POST /okr/objectives/:id/key-results */
  createKeyResult: (objectiveId: string, dto: CreateKeyResultDto) =>
    apiClient
      .post<BaseResponse<KeyResult>>(`/okr/objectives/${objectiveId}/key-results`, dto)
      .then((r) => r.data.data!),

  /** PATCH /okr/key-results/:id */
  updateKeyResult: (keyResultId: string, dto: UpdateKeyResultDto) =>
    apiClient
      .patch<BaseResponse<KeyResult>>(`/okr/key-results/${keyResultId}`, dto)
      .then((r) => r.data.data!),

  /** PATCH /okr/key-results/:id/check-in */
  checkIn: (keyResultId: string, dto: CheckInDto) =>
    apiClient
      .patch<BaseResponse<KeyResult>>(`/okr/key-results/${keyResultId}/check-in`, dto)
      .then((r) => r.data.data!),

  /** POST /okr/key-results/:id/link-task/:taskId */
  linkTask: (keyResultId: string, taskId: string) =>
    apiClient
      .post<BaseResponse<OKRTaskLink>>(`/okr/key-results/${keyResultId}/link-task/${taskId}`)
      .then((r) => r.data.data!),

  /** DELETE /okr/key-results/:id/link-task/:taskId */
  unlinkTask: (keyResultId: string, taskId: string) =>
    apiClient
      .delete<BaseResponse<{ success: boolean }>>(
        `/okr/key-results/${keyResultId}/link-task/${taskId}`,
      )
      .then((r) => r.data.data!),
};
