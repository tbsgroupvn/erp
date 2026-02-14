import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export const employeesApi = {
  /** GET /employees */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/employees', { params })
      .then((r) => r.data),

  /** GET /employees/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<unknown>>(`/employees/${id}`)
      .then((r) => r.data.data),

  /** POST /employees */
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>('/employees', data)
      .then((r) => r.data.data),

  /** PATCH /employees/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/employees/${id}`, data)
      .then((r) => r.data.data),

  /** GET /employees/headcount */
  getHeadcount: (branch?: string) =>
    apiClient
      .get<BaseResponse<unknown>>('/employees/headcount', { params: { branch } })
      .then((r) => r.data.data),

  /** GET /employees/department/:deptCode */
  getByDepartment: (deptCode: string) =>
    apiClient
      .get<BaseResponse<unknown[]>>(`/employees/department/${deptCode}`)
      .then((r) => r.data.data),

  /** POST /employees/:id/deactivate */
  deactivate: (id: string, data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>(`/employees/${id}/deactivate`, data)
      .then((r) => r.data.data),
};
