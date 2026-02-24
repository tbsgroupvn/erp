/**
 * Domain Events Registry — Central definition of all domain events.
 * Ensures type safety and discoverability across modules.
 */

// Order Domain
export interface OrderCompletedEvent {
  orderId: string;
  customerId: string;
  arId?: string;
  invoiceId?: string;
  completedBy: string;
}

export interface OrderCancelledEvent {
  orderId: string;
  cancelledBy: string;
  reason: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
}

// Finance Domain
export interface ARPaymentReceivedEvent {
  arId: string;
  orderId: string;
  amount: number;
  paidBy: string;
}

export interface PaymentVoucherCreatedEvent {
  voucherId: string;
  type: string;
  amount: number;
  createdBy: string;
}

// Commission Domain
export interface CommissionCalculateEvent {
  orderId: string;
  saleId: string;
  totalAmount: number;
}

export interface CommissionApprovedEvent {
  commissionId: string;
  saleId: string;
  amount: number;
}

// Warehouse Domain
export interface PackageReceivedEvent {
  packageId: string;
  orderId: string;
  warehouseId: string;
}

export interface DeliveryCompletedEvent {
  deliveryId: string;
  driverId: string;
  completedAt: Date;
}

// Notification triggers
export interface ApprovalSubmittedEvent {
  approvalId: string;
  type: string;
  requesterId: string;
  approverIds: string[];
}

/**
 * Event name constants for type-safe event emission.
 */
export const DomainEvents = {
  // Order
  ORDER_COMPLETED: 'order.completed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status.changed',

  // Finance
  AR_PAYMENT_RECEIVED: 'ar.payment.received',
  PAYMENT_VOUCHER_CREATED: 'payment.voucher.created',

  // Commission
  COMMISSION_CALCULATE: 'order.commission.calculate',
  COMMISSION_APPROVED: 'commission.approved',

  // Warehouse
  PACKAGE_RECEIVED: 'package.received',
  DELIVERY_COMPLETED: 'delivery.completed',

  // System
  APPROVAL_SUBMITTED: 'approval.submitted',
  APPROVAL_OVERDUE: 'approval.overdue',

  // COD
  COD_COLLECTED: 'cod.collected',
  COD_REMITTED: 'cod.remitted',
} as const;
