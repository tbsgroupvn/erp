import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  Contract,
  CreateContractDto,
  UpdateContractDto,
  ContractQueryParams,
} from '@/lib/types';
import type { ContractStatus } from '@/lib/types';

export const contractsApi = {
  /** GET /contracts */
  list: (params?: ContractQueryParams) => {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
        )
      : undefined;
    return apiClient
      .get<PaginatedResponse<Contract>>('/contracts', { params: cleanParams })
      .then((r) => r.data);
  },

  /** GET /contracts/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Contract>>(`/contracts/${id}`)
      .then((r) => r.data.data),

  /** POST /contracts */
  create: (data: CreateContractDto) =>
    apiClient
      .post<BaseResponse<Contract>>('/contracts', data)
      .then((r) => r.data.data),

  /** PUT /contracts/:id */
  update: (id: string, data: UpdateContractDto) =>
    apiClient
      .put<BaseResponse<Contract>>(`/contracts/${id}`, data)
      .then((r) => r.data.data),

  /** POST /contracts/:id/status */
  updateStatus: (id: string, status: ContractStatus) =>
    apiClient
      .post<BaseResponse<Contract>>(`/contracts/${id}/status`, { status })
      .then((r) => r.data.data),

  /** DELETE /contracts/:id */
  delete: (id: string) =>
    apiClient
      .delete<BaseResponse<null>>(`/contracts/${id}`)
      .then((r) => r.data),
};
