import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Order,
  OrderQueryParams,
  CreateOrderDto,
  UpdateOrderDto,
} from '@/lib/types';

export const ordersApi = {
  list(params?: OrderQueryParams) {
    return apiClient.get<PaginatedResponse<Order>>('/orders', { params });
  },
  getById(id: string) {
    return apiClient.get<BaseResponse<Order>>(`/orders/${id}`);
  },
  create(dto: CreateOrderDto) {
    return apiClient.post<BaseResponse<Order>>('/orders', dto);
  },
  update(id: string, dto: UpdateOrderDto) {
    return apiClient.patch<BaseResponse<Order>>(`/orders/${id}`, dto);
  },
  changeStatus(id: string, data: { status: string; note?: string }) {
    return apiClient.patch<BaseResponse<Order>>(`/orders/${id}/status`, data);
  },
  cancel(id: string, reason: string) {
    return apiClient.patch<BaseResponse<Order>>(`/orders/${id}/cancel`, { reason });
  },
};
