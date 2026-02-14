import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

export const qcApi = {
  /** GET /qc/inspections */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<PaginatedResponse<unknown>>('/qc/inspections', { params })
      .then((r) => r.data),

  /** GET /qc/inspections/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<unknown>>(`/qc/inspections/${id}`)
      .then((r) => r.data.data),

  /** POST /qc/inspections */
  create: (data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>('/qc/inspections', data)
      .then((r) => r.data.data),

  /** PATCH /qc/inspections/:id */
  update: (id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<BaseResponse<unknown>>(`/qc/inspections/${id}`, data)
      .then((r) => r.data.data),

  /** POST /qc/inspections/:id/start */
  startInspection: (id: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/qc/inspections/${id}/start`)
      .then((r) => r.data.data),

  /** POST /qc/inspections/:id/complete */
  completeInspection: (id: string, data: Record<string, unknown>) =>
    apiClient
      .post<BaseResponse<unknown>>(`/qc/inspections/${id}/complete`, data)
      .then((r) => r.data.data),

  /** POST /qc/inspections/:id/send-customer-review */
  sendCustomerReview: (id: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/qc/inspections/${id}/send-customer-review`)
      .then((r) => r.data.data),

  /** POST /qc/inspections/:id/upload-photos */
  uploadPhotos: (id: string, formData: FormData) =>
    apiClient
      .post<BaseResponse<unknown>>(`/qc/inspections/${id}/upload-photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data),

  /** GET /qc/inspections/statistics */
  getStatistics: (params?: Record<string, unknown>) =>
    apiClient
      .get<BaseResponse<unknown>>('/qc/inspections/statistics', { params })
      .then((r) => r.data.data),
};
