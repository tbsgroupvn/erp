import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Container,
  CreateContainerDto,
  ContainerQueryParams,
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

  /** POST /containers/:id/packages — add packages to container */
  addPackages: (id: string, packageIds: string[]) =>
    apiClient
      .post<BaseResponse<Container>>(`/containers/${id}/packages`, { packageIds })
      .then((r) => r.data.data),

  /** PATCH /containers/:id/status */
  updateStatus: (id: string, status: Container['status']) =>
    apiClient
      .patch<BaseResponse<Container>>(`/containers/${id}/status`, { status })
      .then((r) => r.data.data),

  /** GET /containers/consolidation-plan?route=:route */
  getConsolidationPlan: (route: string) =>
    apiClient
      .get<
        BaseResponse<{
          containers: Container[];
          pendingPackages: unknown[];
        }>
      >('/containers/consolidation-plan', { params: { route } })
      .then((r) => r.data.data),
};
