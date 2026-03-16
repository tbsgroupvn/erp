import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum CandidateStatus {
  NEW = 'NEW',
  SCREENING = 'SCREENING',
  INTERVIEW = 'INTERVIEW',
  OFFERED = 'OFFERED',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
}

export enum CandidateSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  JOB_BOARD = 'JOB_BOARD',
  LINKEDIN = 'LINKEDIN',
  HEADHUNT = 'HEADHUNT',
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Candidate {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  position: string;
  status: CandidateStatus;
  source?: string | null;
  resumeUrl?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateDto {
  fullName: string;
  email?: string;
  phone?: string;
  position: string;
  source?: CandidateSource;
  resumeUrl?: string;
  notes?: string;
}

export type UpdateCandidateDto = Partial<CreateCandidateDto>;

export interface UpdateCandidateStatusDto {
  status: CandidateStatus;
  reason?: string;
}

export interface CandidateQueryParams {
  page?: number;
  limit?: number;
  status?: CandidateStatus;
  search?: string;
  position?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CandidateStats {
  total: number;
  byStatus: Record<CandidateStatus, number>;
  labels: Record<CandidateStatus, string>;
}

export interface KanbanColumn {
  label: string;
  count: number;
  items: Candidate[];
}

export type KanbanBoard = Record<CandidateStatus, KanbanColumn>;

// ─── API calls ───────────────────────────────────────────────────────────────

export const recruitmentApi = {
  /** POST /recruitment */
  create: (data: CreateCandidateDto) =>
    apiClient
      .post<BaseResponse<Candidate>>('/recruitment', data)
      .then((r) => r.data.data),

  /** GET /recruitment */
  list: (params?: CandidateQueryParams) =>
    apiClient
      .get<PaginatedResponse<Candidate>>('/recruitment', {
        params: params
          ? Object.fromEntries(
              Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
            )
          : undefined,
      })
      .then((r) => r.data),

  /** GET /recruitment/stats */
  getStats: () =>
    apiClient
      .get<BaseResponse<CandidateStats>>('/recruitment/stats')
      .then((r) => r.data.data),

  /** GET /recruitment/board */
  getBoard: (search?: string) =>
    apiClient
      .get<BaseResponse<KanbanBoard>>('/recruitment/board', {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data.data),

  /** GET /recruitment/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Candidate>>(`/recruitment/${id}`)
      .then((r) => r.data.data),

  /** PATCH /recruitment/:id */
  update: (id: string, data: UpdateCandidateDto) =>
    apiClient
      .patch<BaseResponse<Candidate>>(`/recruitment/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /recruitment/:id/status */
  updateStatus: (id: string, data: UpdateCandidateStatusDto) =>
    apiClient
      .patch<BaseResponse<Candidate>>(`/recruitment/${id}/status`, data)
      .then((r) => r.data.data),

  /** DELETE /recruitment/:id */
  delete: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/recruitment/${id}`)
      .then((r) => r.data.data),
};
