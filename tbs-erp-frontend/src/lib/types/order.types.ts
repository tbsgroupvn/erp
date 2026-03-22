// ============================================
// ORDER TYPES — Order, OrderItem, StatusHistory, PreAlert
// ============================================

import { QueryParams } from './common.types';
import {
  Branch,
  ClearanceType,
  Currency,
  MasterOrderStatus,
  OrderStatus,
  ServiceType,
  ShippingRoute,
} from './enums';

/** Full Order entity as returned by the API */
export interface Order {
  id: string;
  code: string;
  customerId: string;
  saleId: string;
  serviceType: ServiceType;
  status: OrderStatus;
  branch: Branch;

  // Finance
  totalAmount: number;
  currency: Currency;
  depositRequired: number;
  depositPaid: number;
  isDepositPaid: boolean;
  discountPercent: number;
  discountAmount: number;

  // Shipping
  shippingRoute: ShippingRoute | null;
  containerId: string | null;

  // Weight totals
  totalActualWeight: number | null;
  totalChargeableWeight: number | null;

  // Master order link
  masterOrderId: string | null;
  subOrderSuffix: string | null;
  clearanceType: ClearanceType;

  // Contract link
  contractId: string | null;

  baseExchangeRate?: number;
  exchangeRateMode?: string;
  fulfillmentStatus?: 'FULL' | 'PARTIAL' | 'NONE';

  note: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Nested relations (optionally populated)
  contract?: {
    id: string;
    code: string;
    title: string;
    status: string;
    quotationId?: string;
    quotation?: {
      id: string;
      code: string;
    };
  } | null;
  customer?: {
    id: string;
    code: string;
    fullName: string;
    companyName: string | null;
    phone: string;
    tier: string;
  };
  masterOrder?: {
    id: string;
    code: string;
    overallStatus: MasterOrderStatus;
  } | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
}

/** Single item within an order */
export interface OrderItem {
  id: string;
  orderId: string;
  productName: string;
  productUrl: string | null;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalPrice: number;

  // MHH: Product variant
  color: string | null;
  size: string | null;
  specification: string | null;

  // MHH: Cost breakdown
  serviceFeePercent: number | null;
  serviceFeeAmount: number | null;
  domesticShippingCN: number | null;
  exchangeRateUsed: number | null;
  actualSupplierPrice: number | null;
  totalCostCNY: number | null;
  totalCostVND: number | null;

  note: string | null;
  fulfilledQuantity?: number;
  createdAt: string;
}

/** Status change audit record */
export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

/** Pre-alert (tracking info sent ahead of shipment arrival) */
export interface PreAlert {
  id: string;
  customerId: string;
  trackingNumber: string;
  description: string | null;
  expectedPieces: number | null;
  imageUrl: string | null;
  status: 'WAITING' | 'RECEIVED' | 'ASSIGNED';
  matchedPackageId: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO for creating a new order */
export interface CreateOrderDto {
  customerId: string;
  serviceType: ServiceType;
  branch: Branch;
  shippingRoute?: ShippingRoute;
  currency?: Currency;
  note?: string;
  items: CreateOrderItemDto[];
}

/** DTO for creating an order item */
export interface CreateOrderItemDto {
  productName: string;
  productUrl?: string;
  quantity: number;
  unitPrice: number;
  currency?: Currency;
  // MHH variant fields
  color?: string;
  size?: string;
  specification?: string;
  // MHH cost fields (optional, can be auto-calculated)
  domesticShippingCN?: number;
  note?: string;
}

/** DTO for updating an existing order */
export interface UpdateOrderDto {
  serviceType?: ServiceType;
  shippingRoute?: ShippingRoute;
  note?: string;
  discountPercent?: number;
  items?: CreateOrderItemDto[];
}

/** Query params specific to order listing */
export interface OrderQueryParams extends QueryParams {
  status?: OrderStatus;
  serviceType?: ServiceType;
  branch?: Branch;
  customerId?: string;
  saleId?: string;
  shippingRoute?: ShippingRoute;
  clearanceType?: ClearanceType;
  startDate?: string;
  endDate?: string;
}

// ============================================
// MASTER ORDER TYPES
// ============================================

/** Full MasterOrder entity as returned by the API */
export interface MasterOrder {
  id: string;
  code: string;           // #NV001.070226.0001
  customerId: string;
  customer: {
    id: string;
    code: string;
    fullName: string;
    companyName: string | null;
    phone: string;
  };
  saleId: string;
  sale: {
    id: string;
    fullName: string;
    saleCode: string | null;
  };
  branch: Branch;
  overallStatus: MasterOrderStatus;
  note: string | null;
  subOrders: Order[];
  _count?: {
    subOrders: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** DTO for creating a sub order within a master order */
export interface CreateSubOrderDto {
  serviceType: ServiceType;
  clearanceType: ClearanceType;
  shippingRoute?: ShippingRoute;
  items: CreateOrderItemDto[];
  note?: string;
}

/** DTO for creating a new master order with sub orders */
export interface CreateMasterOrderDto {
  customerId: string;
  branch: Branch;
  note?: string;
  subOrders: CreateSubOrderDto[];
}

/** Query params for master order listing */
export interface MasterOrderQueryParams extends QueryParams {
  status?: MasterOrderStatus;
  customerId?: string;
  saleId?: string;
  branch?: Branch;
  startDate?: string;
  endDate?: string;
}
