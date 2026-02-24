import { QueryParams } from './common.types';
import { SupplierOrderStatus, Currency } from './enums';

export interface SupplierOrder {
  id: string;
  code: string;
  orderId: string;
  orderItemId: string | null;
  vendorId: string | null;
  supplierName: string;
  supplierPlatform: string | null;
  supplierOrderNumber: string | null;
  supplierUrl: string | null;
  trackingNumberCN: string | null;
  status: SupplierOrderStatus;
  quotedPriceCNY: number | null;
  actualPriceCNY: number | null;
  shippingFeeCNY: number | null;
  totalCNY: number | null;
  exchangeRate: number | null;
  totalVND: number | null;
  quantityOrdered: number | null;
  quantityReceived: number | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  note: string | null;
  internalNote: string | null;
  attachments: string[];
  orderedAt: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    code: string;
  };
  orderItem?: {
    id: string;
    productName: string;
  } | null;
}

export interface CreateSupplierOrderDto {
  orderId: string;
  orderItemId?: string;
  vendorId?: string;
  supplierName: string;
  supplierPlatform?: string;
  supplierOrderNumber?: string;
  supplierUrl?: string;
  quotedPriceCNY?: number;
  shippingFeeCNY?: number;
  quantityOrdered?: number;
  estimatedDelivery?: string;
  note?: string;
  internalNote?: string;
  attachments?: string[];
}

export interface UpdateSupplierOrderDto {
  supplierName?: string;
  supplierPlatform?: string;
  supplierOrderNumber?: string;
  supplierUrl?: string;
  quotedPriceCNY?: number;
  shippingFeeCNY?: number;
  quantityOrdered?: number;
  estimatedDelivery?: string;
  note?: string;
  internalNote?: string;
  attachments?: string[];
}

export interface RecordReceivedDto {
  quantityReceived?: number;
  actualPriceCNY?: number;
  note?: string;
  attachments?: string[];
}

export interface SupplierOrderQueryParams extends QueryParams {
  status?: SupplierOrderStatus;
  orderId?: string;
  startDate?: string;
  endDate?: string;
}
