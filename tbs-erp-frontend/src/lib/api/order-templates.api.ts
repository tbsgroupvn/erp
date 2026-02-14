import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  OrderTemplate,
  CreateOrderTemplateDto,
  UpdateOrderTemplateDto,
  OrderTemplateQueryParams,
} from '@/lib/types';

export const orderTemplatesApi = {
  /** GET /order-templates */
  list: (params?: OrderTemplateQueryParams) =>
    apiClient
      .get<PaginatedResponse<OrderTemplate>>('/order-templates', { params })
      .then((r) => r.data),

  /** GET /order-templates/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<OrderTemplate>>(`/order-templates/${id}`)
      .then((r) => r.data.data),

  /** POST /order-templates */
  create: (data: CreateOrderTemplateDto) =>
    apiClient
      .post<BaseResponse<OrderTemplate>>('/order-templates', data)
      .then((r) => r.data.data),

  /** PATCH /order-templates/:id */
  update: (id: string, data: UpdateOrderTemplateDto) =>
    apiClient
      .patch<BaseResponse<OrderTemplate>>(`/order-templates/${id}`, data)
      .then((r) => r.data.data),

  /** DELETE /order-templates/:id */
  delete: (id: string) =>
    apiClient
      .delete<BaseResponse<void>>(`/order-templates/${id}`)
      .then((r) => r.data),
};
