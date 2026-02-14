import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Customer,
  CustomerQueryParams,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@/lib/types';

export const customersApi = {
  list(params?: CustomerQueryParams) {
    return apiClient.get<PaginatedResponse<Customer>>('/customers', { params });
  },
  getById(id: string) {
    return apiClient.get<BaseResponse<Customer>>(`/customers/${id}`);
  },
  create(dto: CreateCustomerDto) {
    return apiClient.post<BaseResponse<Customer>>('/customers', dto);
  },
  update(id: string, dto: UpdateCustomerDto) {
    return apiClient.patch<BaseResponse<Customer>>(`/customers/${id}`, dto);
  },
};
