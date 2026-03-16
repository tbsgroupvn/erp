import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Container,
  CreateContainerDto,
  ContainerQueryParams,
  ConsolidationPlanSuggestion,
  ContainerTimeline,
  ContainerCostBreakdown,
  ContainerWeightReconciliation,
  ContainerCustomsSplitStatus,
  RecordDeliveryOrderDto,
  UpdateFreeTimeDto,
} from '@/lib/types';

export const containersApi = {
  /** GET /containers */
  list: (params?: ContainerQueryParams) =>
    apiClient
      .get<PaginatedResponse<Container>>('/containers', { params })
      .then((r) => r.data),

  /** GET /containers/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Container>>(`/containers/${id}`)
      .then((r) => r.data.data),

  /** POST /containers */
  create: (data: CreateContainerDto) =>
    apiClient
      .post<BaseResponse<Container>>('/containers', data)
      .then((r) => r.data.data),

  /** PATCH /containers/:id */
  update: (id: string, data: Partial<CreateContainerDto>) =>
    apiClient
      .patch<BaseResponse<Container>>(`/containers/${id}`, data)
      .then((r) => r.data.data),

  /** POST /containers/:id/add-packages */
  addPackages: (id: string, packageIds: string[]) =>
    apiClient
      .post<BaseResponse<Container>>(`/containers/${id}/add-packages`, { packageIds })
      .then((r) => r.data.data),

  /** PATCH /containers/:id/status */
  updateStatus: (id: string, status: Container['status']) =>
    apiClient
      .patch<BaseResponse<Container>>(`/containers/${id}/status`, { status })
      .then((r) => r.data.data),

  /** GET /containers/consolidation-plan */
  getConsolidationPlan: () =>
    apiClient
      .get<BaseResponse<ConsolidationPlanSuggestion[]>>('/containers/consolidation-plan')
      .then((r) => r.data.data),

  /** GET /containers/:id/fill-rate */
  getFillRate: (id: string) =>
    apiClient
      .get<BaseResponse<{ fillRate: number; totalWeight: number; maxCapacity: number | null }>>(`/containers/${id}/fill-rate`)
      .then((r) => r.data.data),

  /** GET /containers/:id/timeline */
  getTimeline: (id: string) =>
    apiClient
      .get<BaseResponse<ContainerTimeline>>(`/containers/${id}/timeline`)
      .then((r) => r.data.data),

  /** GET /containers/:id/cost-breakdown */
  getCostBreakdown: (id: string) =>
    apiClient
      .get<BaseResponse<ContainerCostBreakdown>>(`/containers/${id}/cost-breakdown`)
      .then((r) => r.data.data),

  /** GET /containers/:id/weight-reconciliation */
  getWeightReconciliation: (id: string) =>
    apiClient
      .get<BaseResponse<ContainerWeightReconciliation>>(`/containers/${id}/weight-reconciliation`)
      .then((r) => r.data.data),

  /** GET /containers/:id/customs-split/status */
  getCustomsSplitStatus: (id: string) =>
    apiClient
      .get<BaseResponse<ContainerCustomsSplitStatus>>(`/containers/${id}/customs-split/status`)
      .then((r) => r.data.data),

  /** POST /containers/:id/delivery-order */
  recordDeliveryOrder: (id: string, data: RecordDeliveryOrderDto) =>
    apiClient
      .post<BaseResponse<Container>>(`/containers/${id}/delivery-order`, data)
      .then((r) => r.data.data),

  /** PATCH /containers/:id/free-time */
  updateFreeTime: (id: string, data: UpdateFreeTimeDto) =>
    apiClient
      .patch<BaseResponse<Container>>(`/containers/${id}/free-time`, data)
      .then((r) => r.data.data),

  /** GET /containers/:id/unload-manifest */
  getUnloadManifest: (id: string) =>
    apiClient
      .get<BaseResponse<any>>(`/containers/${id}/unload-manifest`)
      .then((r) => r.data.data),
};
