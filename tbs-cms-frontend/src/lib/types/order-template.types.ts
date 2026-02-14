import type { ServiceType, ClearanceType, ShippingRoute, Branch } from './enums';
import type { QueryParams } from './common.types';

export interface OrderTemplateItem {
  id?: string;
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface OrderTemplateSubOrder {
  id?: string;
  serviceType: ServiceType;
  clearanceType: ClearanceType;
  shippingRoute?: ShippingRoute;
  note?: string;
  items: OrderTemplateItem[];
}

export interface OrderTemplate {
  id: string;
  name: string;
  description?: string;
  branch?: Branch;
  subOrders: OrderTemplateSubOrder[];
  createdById: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderTemplateDto {
  name: string;
  description?: string;
  branch?: Branch;
  subOrders: Omit<OrderTemplateSubOrder, 'id'>[];
}

export interface UpdateOrderTemplateDto {
  name?: string;
  description?: string;
  branch?: Branch;
  subOrders?: Omit<OrderTemplateSubOrder, 'id'>[];
}

export interface OrderTemplateQueryParams extends QueryParams {
  search?: string;
  branch?: Branch;
}
