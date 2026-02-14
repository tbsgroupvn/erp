import type { QueryParams } from './common.types';

// ---------------------------------------------------------------------------
// Supplier Order Status
// ---------------------------------------------------------------------------

export type SupplierOrderStatus =
  | 'DRAFT'
  | 'QUOTED'
  | 'ORDERED'
  | 'CONFIRMED'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED_CN'
  | 'RECEIVED_CN'
  | 'CANCELLED'
  | 'ISSUE';

// ---------------------------------------------------------------------------
// Supplier Order Entity
// ---------------------------------------------------------------------------

export interface SupplierOrder {
  id: string;
  code: string;
  orderId: string;
  supplierName: string;
  supplierPlatform?: string;
  status: SupplierOrderStatus;
  quotedPriceCNY?: number;
  actualPriceCNY?: number;
  quantityOrdered: number;
  quantityReceived: number;
  trackingNumberCN?: string;
  orderedAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateSupplierOrderDto {
  orderId: string;
  supplierName: string;
  supplierPlatform?: string;
  quotedPriceCNY?: number;
  quantityOrdered: number;
  note?: string;
}

export interface UpdateSupplierOrderDto {
  supplierName?: string;
  supplierPlatform?: string;
  quotedPriceCNY?: number;
  actualPriceCNY?: number;
  quantityOrdered?: number;
  quantityReceived?: number;
  trackingNumberCN?: string;
  note?: string;
}

export interface SupplierOrderQueryParams extends QueryParams {
  orderId?: string;
  status?: SupplierOrderStatus;
}
