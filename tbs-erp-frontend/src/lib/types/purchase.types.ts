import type { QueryParams } from './common.types';
import type { Currency, PurchaseStatus } from './enums';

export interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  vendorId: string;
  vendor?: { id: string; name: string; code: string };
  orderId?: string;
  currency: Currency;
  totalAmount: number;
  status: PurchaseStatus;
  notes?: string;
  items: PurchaseItem[];
  createdBy: string;
  createdByUser?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  purchaseRequestId?: string;
  vendorId: string;
  vendor?: { id: string; name: string; code: string };
  currency: Currency;
  totalAmount: number;
  status: PurchaseStatus;
  notes?: string;
  items: PurchaseItem[];
  createdBy: string;
  createdByUser?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseQueryParams extends QueryParams {
  status?: PurchaseStatus;
  vendorId?: string;
}

export interface CreatePurchaseRequestDto {
  vendorId: string;
  orderId?: string;
  currency: Currency;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
}
