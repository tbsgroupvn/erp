import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Order,
  CreateOrderDto,
  UpdateOrderDto,
  OrderQueryParams,
  OrderStatus,
  MasterOrder,
  CreateMasterOrderDto,
  CreateSubOrderDto,
  MasterOrderQueryParams,
} from '@/lib/types';

export const ordersApi = {
  /** GET /orders */
  list: (params?: OrderQueryParams) => {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
        )
      : undefined;
    return apiClient
      .get<PaginatedResponse<Order>>('/orders', { params: cleanParams })
      .then((r) => r.data);
  },

  /** GET /orders/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Order>>(`/orders/${id}`)
      .then((r) => r.data.data),

  /** POST /orders */
  create: (data: CreateOrderDto) =>
    apiClient
      .post<BaseResponse<Order>>('/orders', data)
      .then((r) => r.data.data),

  /** PATCH /orders/:id */
  update: (id: string, data: UpdateOrderDto) =>
    apiClient
      .patch<BaseResponse<Order>>(`/orders/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /orders/:id/status */
  changeStatus: (id: string, status: OrderStatus, note?: string) =>
    apiClient
      .patch<BaseResponse<Order>>(`/orders/${id}/status`, { status, note })
      .then((r) => r.data.data),

  /** POST /orders/:id/cancel */
  cancel: (id: string, reason: string) =>
    apiClient
      .post<BaseResponse<Order>>(`/orders/${id}/cancel`, { reason })
      .then((r) => r.data.data),

  /** POST /orders/:id/reopen */
  reopen: (id: string, reason: string) =>
    apiClient
      .post<BaseResponse<Order>>(`/orders/${id}/reopen`, { reason })
      .then((r) => r.data.data),
};

export const masterOrdersApi = {
  /** GET /master-orders */
  list: (params?: MasterOrderQueryParams) => {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== ''),
        )
      : undefined;
    return apiClient
      .get<PaginatedResponse<MasterOrder>>('/master-orders', { params: cleanParams })
      .then((r) => r.data);
  },

  /** GET /master-orders/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<MasterOrder>>(`/master-orders/${id}`)
      .then((r) => r.data.data),

  /** POST /master-orders */
  create: (data: CreateMasterOrderDto) =>
    apiClient
      .post<BaseResponse<MasterOrder>>('/master-orders', data)
      .then((r) => r.data.data),

  /** POST /master-orders/:id/sub-orders */
  addSubOrder: (id: string, data: CreateSubOrderDto) =>
    apiClient
      .post<BaseResponse<MasterOrder>>(`/master-orders/${id}/sub-orders`, data)
      .then((r) => r.data.data),
};
