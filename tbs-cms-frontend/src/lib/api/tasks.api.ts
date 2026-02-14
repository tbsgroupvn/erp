import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export const tasksApi = {
  /** GET /tasks */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/tasks', { params })
      .then((r) => r.data),

  /** GET /tasks/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<unknown>>(`/tasks/${id}`)
      .then((r) => r.data.data),

  /** POST /tasks */
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>('/tasks', data)
      .then((r) => r.data.data),

  /** PATCH /tasks/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/tasks/${id}`, data)
      .then((r) => r.data.data),

  /** GET /tasks/my */
  getMyTasks: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/tasks/my', { params })
      .then((r) => r.data),

  /** GET /tasks/overdue */
  getOverdue: () =>
    apiClient
      .get<BaseResponse<unknown[]>>('/tasks/overdue')
      .then((r) => r.data.data),

  /** PATCH /tasks/:id/assign */
  assign: (id: string, assigneeId: string) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/tasks/${id}/assign`, { assigneeId })
      .then((r) => r.data.data),

  /** PATCH /tasks/:id/status */
  changeStatus: (id: string, status: string) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/tasks/${id}/status`, { status })
      .then((r) => r.data.data),

  /** POST /tasks/:id/comments */
  addComment: (id: string, content: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/tasks/${id}/comments`, { content })
      .then((r) => r.data.data),
};
