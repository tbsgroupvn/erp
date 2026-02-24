import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  Quotation,
  CreateQuotationDto,
  QuotationQueryParams,
  QuotationTemplate,
  CreateTemplateDto,
  SaveAsTemplateDto,
  CreateFromTemplateDto,
  RecentQuotationItem,
} from '@/lib/types';

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
      .post<BaseResponse<Quotation & { contractAppendixId?: string; contractAppendixCode?: string }>>(`/quotations/${id}/approve`)
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

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  /** GET /quotations/templates */
  listTemplates: () =>
    apiClient
      .get<BaseResponse<QuotationTemplate[]>>('/quotations/templates')
      .then((r) => r.data.data),

  /** POST /quotations/templates */
  createTemplate: (data: CreateTemplateDto) =>
    apiClient
      .post<BaseResponse<QuotationTemplate>>('/quotations/templates', data)
      .then((r) => r.data.data),

  /** DELETE /quotations/templates/:id */
  deleteTemplate: (id: string) =>
    apiClient
      .delete<BaseResponse<null>>(`/quotations/templates/${id}`)
      .then((r) => r.data),

  /** POST /quotations/:id/save-as-template */
  saveAsTemplate: (id: string, data: SaveAsTemplateDto) =>
    apiClient
      .post<BaseResponse<QuotationTemplate>>(`/quotations/${id}/save-as-template`, data)
      .then((r) => r.data.data),

  /** POST /quotations/from-template/:templateId */
  createFromTemplate: (templateId: string, data: CreateFromTemplateDto) =>
    apiClient
      .post<BaseResponse<Quotation>>(`/quotations/from-template/${templateId}`, data)
      .then((r) => r.data.data),

  // =========================================================================
  // RECENT ITEMS
  // =========================================================================

  /** GET /quotations/customer/:customerId/recent-items */
  getRecentItems: (customerId: string) =>
    apiClient
      .get<BaseResponse<RecentQuotationItem[]>>(`/quotations/customer/${customerId}/recent-items`)
      .then((r) => r.data.data),
};
