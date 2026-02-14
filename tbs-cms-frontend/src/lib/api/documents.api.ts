import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type { Document, DocumentQueryParams } from '@/lib/types/document.types';

export const documentsApi = {
  /** GET /documents */
  list: (params?: DocumentQueryParams) =>
    apiClient
      .get<PaginatedResponse<Document>>('/documents', { params })
      .then((r) => r.data),

  /** GET /documents/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Document>>(`/documents/${id}`)
      .then((r) => r.data.data),

  /** POST /documents (multipart upload) */
  upload: (formData: FormData) =>
    apiClient
      .post<BaseResponse<Document>>('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data),

  /** DELETE /documents/:id */
  delete: (id: string) =>
    apiClient
      .delete<BaseResponse<void>>(`/documents/${id}`)
      .then((r) => r.data),

  /** GET /documents/:id/download */
  downloadUrl: (id: string) => `${apiClient.defaults.baseURL}/documents/${id}/download`,
};
