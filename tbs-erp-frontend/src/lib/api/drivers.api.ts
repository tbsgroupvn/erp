import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export const driversApi = {
  /** GET /drivers */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/drivers', { params })
      .then((r) => r.data),

  /** GET /drivers/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<unknown>>(`/drivers/${id}`)
      .then((r) => r.data.data),

  /** POST /drivers */
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>('/drivers', data)
      .then((r) => r.data.data),

  /** PATCH /drivers/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/drivers/${id}`, data)
      .then((r) => r.data.data),

  /** GET /drivers/available */
  getAvailable: (branch?: string) =>
    apiClient
      .get<BaseResponse<unknown[]>>('/drivers/available', { params: { branch } })
      .then((r) => r.data.data),

  /** POST /drivers/:id/assign-vehicle */
  assignVehicle: (id: string, vehicleId: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/drivers/${id}/assign-vehicle`, { vehicleId })
      .then((r) => r.data.data),

  /** PATCH /drivers/:id/status */
  updateStatus: (id: string, status: string) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/drivers/${id}/status`, { status })
      .then((r) => r.data.data),

  /** GET /drivers/:id/deliveries */
  getDeliveryHistory: (id: string, params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>(`/drivers/${id}/deliveries`, { params })
      .then((r) => r.data),

  /** GET /drivers/:id/performance */
  getPerformance: (id: string, params?: Record<string, unknown>) =>
    apiClient
      .get<BaseResponse<unknown>>(`/drivers/${id}/performance`, { params })
      .then((r) => r.data.data),
};
