import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
} from '@/lib/types';
import type {
  CustomsDeclaration,
  CustomsDeclarationLine,
  CustomsDeclarationQueryParams,
  HSCodeResult,
  ComplianceAlert,
  CustomsTaxAllocation,
  GroupingSuggestion,
} from '@/lib/types/customs.types';

export const customsDeclarationApi = {
  /** GET /customs-declarations */
  list: (params?: CustomsDeclarationQueryParams) =>
    apiClient
      .get<PaginatedResponse<CustomsDeclaration>>('/customs-declarations', { params })
      .then((r) => r.data),

  /** GET /customs-declarations/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}`)
      .then((r) => r.data.data),

  /** POST /customs-declarations — create from a container */
  createFromContainer: (containerId: string) =>
    apiClient
      .post<BaseResponse<CustomsDeclaration>>('/customs-declarations', { containerId })
      .then((r) => r.data.data),

  /** PATCH /customs-declarations/:id — update header fields */
  updateHeader: (id: string, data: Partial<CustomsDeclaration>) =>
    apiClient
      .patch<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /customs-declarations/lines/:lineId — update a single line */
  updateLine: (lineId: string, data: Partial<CustomsDeclarationLine>) =>
    apiClient
      .patch<BaseResponse<CustomsDeclarationLine>>(`/customs-declarations/lines/${lineId}`, data)
      .then((r) => r.data.data),

  /** DELETE /customs-declarations/lines/:lineId — remove a line */
  removeLine: (lineId: string) =>
    apiClient
      .delete<BaseResponse<void>>(`/customs-declarations/lines/${lineId}`)
      .then((r) => r.data),

  /** PATCH /customs-declarations/:id/status — update status */
  updateStatus: (id: string, status: string, note?: string) =>
    apiClient
      .patch<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}/status`, {
        status,
        note,
      })
      .then((r) => r.data.data),

  /** PATCH /customs-declarations/:id/channel — assign channel */
  updateChannel: (id: string, channel: string) =>
    apiClient
      .patch<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}/channel`, { channel })
      .then((r) => r.data.data),

  /** POST /customs-declarations/:id/recalculate — recalculate taxes */
  recalculateTax: (id: string) =>
    apiClient
      .post<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}/recalculate`)
      .then((r) => r.data.data),

  /** POST /customs-declarations/:id/allocate-tax — allocate taxes to orders */
  allocateTax: (id: string, method: string) =>
    apiClient
      .post<BaseResponse<CustomsTaxAllocation[]>>(`/customs-declarations/${id}/allocate-tax`, {
        method,
      })
      .then((r) => r.data.data),

  /** GET /customs-declarations/:id/export-ecus5 — download ECUS5 Excel */
  exportEcus5: (id: string) =>
    apiClient
      .get<Blob>(`/customs-declarations/${id}/export-ecus5`, { responseType: 'blob' })
      .then((r) => r.data),

  /** POST /customs-declarations/:id/group-by-hs — auto-group by HS code */
  groupByHs: (id: string) =>
    apiClient
      .post<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}/group-by-hs`)
      .then((r) => r.data.data),

  /** POST /customs-declarations/:id/group-custom — group selected lines */
  groupCustom: (id: string, data: { lineIds: string[]; hsCode: string; description: string }) =>
    apiClient
      .post<BaseResponse<CustomsDeclaration>>(`/customs-declarations/${id}/group-custom`, data)
      .then((r) => r.data.data),

  /** POST /customs-declarations/lines/:lineId/ungroup — ungroup a line */
  ungroupLine: (lineId: string) =>
    apiClient
      .post<BaseResponse<CustomsDeclaration>>(`/customs-declarations/lines/${lineId}/ungroup`)
      .then((r) => r.data.data),

  /** GET /customs-declarations/:id/suggest-groupings — get grouping suggestions */
  suggestGroupings: (id: string) =>
    apiClient
      .get<BaseResponse<GroupingSuggestion[]>>(`/customs-declarations/${id}/suggest-groupings`)
      .then((r) => r.data.data),

  /** GET /customs-declarations/hs-codes/search — search HS codes */
  searchHSCodes: (query: string) =>
    apiClient
      .get<BaseResponse<HSCodeResult[]>>('/customs-declarations/hs-codes/search', {
        params: { query },
      })
      .then((r) => r.data.data),

  /** GET /customs-declarations/hs-codes/suggest — suggest HS code for a product */
  suggestHSCode: (productName: string) =>
    apiClient
      .get<BaseResponse<HSCodeResult[]>>('/customs-declarations/hs-codes/suggest', {
        params: { productName },
      })
      .then((r) => r.data.data),

  /** POST /customs-declarations/:id/check-compliance — run compliance check */
  checkCompliance: (id: string) =>
    apiClient
      .post<BaseResponse<ComplianceAlert[]>>(`/customs-declarations/${id}/check-compliance`)
      .then((r) => r.data.data),

  /** POST /customs-declarations/compliance-alerts/:alertId/acknowledge */
  acknowledgeAlert: (alertId: string) =>
    apiClient
      .post<BaseResponse<ComplianceAlert>>(
        `/customs-declarations/compliance-alerts/${alertId}/acknowledge`,
      )
      .then((r) => r.data.data),
};
