import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  PurchaseRequest,
  PurchaseOrder,
  PurchaseQueryParams,
  CreatePurchaseRequestDto,
} from '@/lib/types/purchase.types';

export const purchasesApi = {
  /** GET /purchase-requests */
  listRequests: (params?: PurchaseQueryParams) =>
    apiClient
      .get<PaginatedResponse<PurchaseRequest>>('/purchase-requests', { params })
      .then((r) => r.data),

  /** GET /purchase-requests/:id */
  getRequestById: (id: string) =>
    apiClient
      .get<BaseResponse<PurchaseRequest>>(`/purchase-requests/${id}`)
      .then((r) => r.data.data),

  /** POST /purchase-requests */
  createRequest: (data: CreatePurchaseRequestDto) =>
    apiClient
      .post<BaseResponse<PurchaseRequest>>('/purchase-requests', data)
      .then((r) => r.data.data),

  /** PATCH /purchase-requests/:id/approve */
  approveRequest: (id: string) =>
    apiClient
      .patch<BaseResponse<PurchaseRequest>>(`/purchase-requests/${id}/approve`)
      .then((r) => r.data.data),

  /** POST /purchase-requests/:id/convert */
  convertToPO: (id: string) =>
    apiClient
      .post<BaseResponse<PurchaseOrder>>(`/purchase-requests/${id}/convert`)
      .then((r) => r.data.data),

  /** GET /purchase-orders */
  listOrders: (params?: PurchaseQueryParams) =>
    apiClient
      .get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params })
      .then((r) => r.data),

  /** GET /purchase-orders/:id */
  getOrderById: (id: string) =>
    apiClient
      .get<BaseResponse<PurchaseOrder>>(`/purchase-orders/${id}`)
      .then((r) => r.data.data),

  /** PATCH /purchase-orders/:id/receive */
  recordReceipt: (id: string) =>
    apiClient
      .patch<BaseResponse<PurchaseOrder>>(`/purchase-orders/${id}/receive`)
      .then((r) => r.data.data),
};
