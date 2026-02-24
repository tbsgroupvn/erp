import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  SupplierOrder,
  CreateSupplierOrderDto,
  UpdateSupplierOrderDto,
  RecordReceivedDto,
  SupplierOrderQueryParams,
  SupplierOrderStatus,
} from '@/lib/types';

export const supplierOrdersApi = {
  /** GET /supplier-orders */
  list: (params?: SupplierOrderQueryParams) => {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
        )
      : undefined;
    return apiClient
      .get<PaginatedResponse<SupplierOrder>>('/supplier-orders', { params: cleanParams })
      .then((r) => r.data);
  },

  /** GET /supplier-orders/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<SupplierOrder>>(`/supplier-orders/${id}`)
      .then((r) => r.data.data),

  /** GET /supplier-orders/order/:orderId */
  getByOrderId: (orderId: string) =>
    apiClient
      .get<BaseResponse<SupplierOrder[]>>(`/supplier-orders/order/${orderId}`)
      .then((r) => r.data.data),

  /** POST /supplier-orders */
  create: (data: CreateSupplierOrderDto) =>
    apiClient
      .post<BaseResponse<SupplierOrder>>('/supplier-orders', data)
      .then((r) => r.data.data),

  /** PATCH /supplier-orders/:id */
  update: (id: string, data: UpdateSupplierOrderDto) =>
    apiClient
      .patch<BaseResponse<SupplierOrder>>(`/supplier-orders/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /supplier-orders/:id/status */
  changeStatus: (id: string, status: SupplierOrderStatus, note?: string) =>
    apiClient
      .patch<BaseResponse<SupplierOrder>>(`/supplier-orders/${id}/status`, { status, note })
      .then((r) => r.data.data),

  /** POST /supplier-orders/:id/received */
  recordReceived: (id: string, data: RecordReceivedDto) =>
    apiClient
      .post<BaseResponse<SupplierOrder>>(`/supplier-orders/${id}/received`, data)
      .then((r) => r.data.data),
};
