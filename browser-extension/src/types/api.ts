import type { Branch, ServiceType } from './index';

/** DTO for creating a master order — mirrors backend CreateMasterOrderDto */
export interface CreateMasterOrderDto {
  customerId: string;
  branch: Branch;
  note?: string;
  subOrders: CreateSubOrderDto[];
}

export interface CreateSubOrderDto {
  serviceType: ServiceType;
  clearanceType: 'CHINH_NGACH' | 'TIEU_NGACH';
  shippingRoute?: 'SEA' | 'ROAD' | 'AIR';
  note?: string;
  items: CreateOrderItemDto[];
}

export interface CreateOrderItemDto {
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

/** Login request */
export interface LoginDto {
  email: string;
  password: string;
}

/** Login response from ERP backend */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

/** API paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
