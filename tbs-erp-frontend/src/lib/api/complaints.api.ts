import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export const complaintsApi = {
  /** GET /complaints */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/complaints', { params })
      .then((r) => r.data),

  /** GET /complaints/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<unknown>>(`/complaints/${id}`)
      .then((r) => r.data.data),

  /** POST /complaints */
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>('/complaints', data)
      .then((r) => r.data.data),

  /** PATCH /complaints/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/complaints/${id}`, data)
      .then((r) => r.data.data),

  /** POST /complaints/:id/assign */
  assignHandler: (id: string, handlerId: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/complaints/${id}/assign`, { handlerId })
      .then((r) => r.data.data),

  /** POST /complaints/:id/resolve */
  resolve: (id: string, data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>(`/complaints/${id}/resolve`, data)
      .then((r) => r.data.data),

  /** POST /complaints/:id/escalate */
  escalate: (id: string, level: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/complaints/${id}/escalate`, { level })
      .then((r) => r.data.data),

  /** GET /complaints/statistics */
  getStatistics: (params?: Record<string, unknown>) =>
    apiClient
      .get<BaseResponse<unknown>>('/complaints/statistics', { params })
      .then((r) => r.data.data),
};
