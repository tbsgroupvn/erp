import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  Vendor,
  VendorQueryParams,
  CreateVendorDto,
  UpdateVendorDto,
  RateVendorDto,
} from '@/lib/types/vendor.types';

export const vendorsApi = {
  /** GET /vendors */
  list: (params?: VendorQueryParams) =>
    apiClient
      .get<PaginatedResponse<Vendor>>('/vendors', { params })
      .then((r) => r.data),

  /** GET /vendors/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Vendor>>(`/vendors/${id}`)
      .then((r) => r.data.data),

  /** POST /vendors */
  create: (data: CreateVendorDto) =>
    apiClient
      .post<BaseResponse<Vendor>>('/vendors', data)
      .then((r) => r.data.data),

  /** PATCH /vendors/:id */
  update: (id: string, data: UpdateVendorDto) =>
    apiClient
      .patch<BaseResponse<Vendor>>(`/vendors/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /vendors/:id/approve */
  toggleApproval: (id: string, isApproved: boolean) =>
    apiClient
      .patch<BaseResponse<Vendor>>(`/vendors/${id}/approve`, { isApproved })
      .then((r) => r.data.data),

  /** POST /vendors/:id/rate */
  rate: (id: string, data: RateVendorDto) =>
    apiClient
      .post<BaseResponse<Vendor>>(`/vendors/${id}/rate`, data)
      .then((r) => r.data.data),
};
