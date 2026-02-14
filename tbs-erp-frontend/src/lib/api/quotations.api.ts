import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type { Quotation, CreateQuotationDto, QuotationQueryParams } from '@/lib/types';

export const quotationsApi = {
  /** GET /quotations */
  list: (params?: QuotationQueryParams) => {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
        )
      : undefined;
    return apiClient
      .get<PaginatedResponse<Quotation>>('/quotations', { params: cleanParams })
      .then((r) => r.data);
  },

  /** GET /quotations/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Quotation>>(`/quotations/${id}`)
      .then((r) => r.data.data),

  /** POST /quotations */
  create: (data: CreateQuotationDto) =>
    apiClient
      .post<BaseResponse<Quotation>>('/quotations', data)
      .then((r) => r.data.data),

  /** PATCH /quotations/:id */
  update: (id: string, data: Partial<CreateQuotationDto>) =>
    apiClient
      .patch<BaseResponse<Quotation>>(`/quotations/${id}`, data)
      .then((r) => r.data.data),

  /** POST /quotations/:id/approve */
  approve: (id: string) =>
    apiClient
      .post<BaseResponse<Quotation>>(`/quotations/${id}/approve`)
      .then((r) => r.data.data),

  /** POST /quotations/:id/reject */
  reject: (id: string, reason: string) =>
    apiClient
      .post<BaseResponse<Quotation>>(`/quotations/${id}/reject`, { reason })
      .then((r) => r.data.data),

  /** POST /quotations/:id/convert */
  convertToOrder: (id: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/quotations/${id}/convert`)
      .then((r) => r.data.data),

  /** POST /quotations/:id/duplicate */
  duplicate: (id: string) =>
    apiClient
      .post<BaseResponse<Quotation>>(`/quotations/${id}/duplicate`)
      .then((r) => r.data.data),

  /** GET /quotations/:id/export/pdf */
  exportPdf: (id: string) =>
    apiClient
      .get(`/quotations/${id}/export/pdf`, { responseType: 'blob' })
      .then((r) => r.data),

  /** GET /quotations/:id/export/excel */
  exportExcel: (id: string) =>
    apiClient
      .get(`/quotations/${id}/export/excel`, { responseType: 'blob' })
      .then((r) => r.data),
};
