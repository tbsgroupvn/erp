// ============================================
// QUOTATION TYPES — Quotation, QuotationItem
// ============================================

import { QuotationStatus, ServiceType, ShippingRoute, Branch } from './enums';

export interface Quotation {
  id: string;
  code: string;
  customerId: string;
  customer?: {
    id: string;
    fullName: string;
    code: string;
    companyName?: string;
    phone?: string;
    email?: string;
    tier?: string;
  };
  status: QuotationStatus;
  serviceType: ServiceType;
  branch: Branch;
  shippingRoute?: ShippingRoute;
  version: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  validUntil?: string;
  note?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  convertedOrderId?: string;
  parentQuotationId?: string;
  items: QuotationItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  totalPrice: number;
  note?: string;
}

export interface CreateQuotationDto {
  customerId: string;
  serviceType: ServiceType;
  branch: Branch;
  shippingRoute?: ShippingRoute;
  discountPercent?: number;
  validityDays?: number;
  note?: string;
  items: CreateQuotationItemDto[];
}

export interface CreateQuotationItemDto {
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  note?: string;
}

export interface QuotationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuotationStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// QUOTATION TEMPLATE TYPES
// ============================================

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  serviceType: ServiceType;
  branch: Branch;
  shippingRoute?: ShippingRoute;
  items: CreateQuotationItemDto[];
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  serviceType: ServiceType;
  branch: Branch;
  shippingRoute?: ShippingRoute;
  items: CreateQuotationItemDto[];
  isPublic?: boolean;
}

export interface SaveAsTemplateDto {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface CreateFromTemplateDto {
  customerId: string;
  discountPercent?: number;
  validityDays?: number;
  note?: string;
}

export interface RecentQuotationItem {
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  note?: string;
}
