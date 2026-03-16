/**
 * Central registry of domain event contracts.
 *
 * All event payloads emitted via EventEmitter2 (in-process) should conform to
 * these interfaces. This file complements the BullMQ-oriented types in
 * `src/core/events/domain-events.ts` by documenting the EventEmitter2 payloads
 * that listeners actually consume.
 *
 * Naming convention: `<Aggregate><Action>Event`
 * Event name convention: `<aggregate>.<action>` (dot-delimited)
 */

// ─── Order Events ───────────────────────────────────────────────────────────

/** Emitted when a new order is created. Event: `order.created` */
export interface OrderCreatedEvent {
  orderId: string;
  code: string;
  customerId: string;
  serviceType: string;
  totalAmount: number;
  depositRequired: number;
  createdBy: string;
  exchangeRateMode: string;
  baseExchangeRate: number | null;
}

/** Emitted when an order's fields are updated. Event: `order.updated` */
export interface OrderUpdatedEvent {
  orderId: string;
  updatedBy: string;
  changes: Record<string, unknown>;
}

/** Emitted when an order transitions status. Event: `order.status.changed` */
export interface OrderStatusChangedEvent {
  orderId: string;
  code: string;
  customerId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  serviceType: string;
}

/** Emitted when an order is confirmed (moves to SOURCING). Event: `order.confirmed` */
export interface OrderConfirmedEvent {
  orderId: string;
  customerId: string;
  totalAmount: number;
  createdBy: string;
}

/** Emitted when an order cancellation is requested. Event: `order.cancel.requested` */
export interface OrderCancelRequestedEvent {
  orderId: string;
  code: string;
  approvalId: string;
  requestedBy: string;
  reason: string;
  cancellation: {
    stage: string;
    depositPaid: number;
    adminFee: number;
    costsIncurred: number;
    refundAmount: number;
    details: string;
  };
}

/** Emitted when an order is cancelled. Event: `order.cancelled` */
export interface OrderCancelledEvent {
  orderId: string;
  code: string;
  customerId: string;
  cancelledBy: string;
  reason: string;
  previousStatus: string;
  cancellation: {
    stage: string;
    depositPaid: number;
    adminFee: number;
    costsIncurred: number;
    refundAmount: number;
    details: string;
  };
}

// ─── Payment / Finance Events ───────────────────────────────────────────────

/** Emitted when a receipt voucher is approved and linked to an order. Event: `payment.received` */
export interface PaymentReceivedEvent {
  orderId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
}

/** Emitted when a voucher is created. Event: `voucher.created` */
export interface VoucherCreatedEvent {
  voucherId: string;
  voucherCode: string;
  type: string;
  approvalType: string;
  amount: number;
  orderId?: string;
  supplierOrderId?: string;
  isFlagged: boolean;
  flagReasons: string[];
  createdBy: string;
}

/** Emitted when a voucher is approved. Event: `voucher.approved` */
export interface VoucherApprovedEvent {
  voucherId: string;
  voucherCode: string;
  type: string;
  amount: number;
  orderId?: string | null;
  approvedBy: string;
}

/** Emitted when a voucher is rejected. Event: `voucher.rejected` */
export interface VoucherRejectedEvent {
  voucherId: string;
  voucherCode: string;
  rejectedBy: string;
  reason?: string;
}

/** Emitted when an AR payment is received. Event: `ar.payment.received` */
export interface ARPaymentReceivedEvent {
  arId: string;
  orderId: string;
  amount: number;
  paidBy: string;
}

// ─── Commission Events ──────────────────────────────────────────────────────

/** Emitted when a commission record is pending. Event: `commission.pending` */
export interface CommissionPendingEvent {
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  netProfit: number;
  createdAt: Date;
}

/** Emitted when a commission is approved. Event: `commission.approved` */
export interface CommissionApprovedEvent {
  commissionId: string;
  saleId: string;
  amount: number;
}

// ─── Customs Events ─────────────────────────────────────────────────────────

/** Emitted when a customs declaration is created. Event: `customs.declaration.created` */
export interface CustomsDeclarationCreatedEvent {
  declarationId: string;
  code: string;
  containerId: string;
  containerCode: string;
  totalLines: number;
  createdBy: string;
}

/** Emitted when a customs declaration status changes. Event: `customs.declaration.status.changed` */
export interface CustomsDeclarationStatusChangedEvent {
  declarationId: string;
  code: string;
  containerId: string;
  fromStatus: string;
  toStatus: string;
  channel?: string | null;
  changedBy: string;
}

/** Emitted when a customs declaration is cleared. Event: `customs.declaration.cleared` */
export interface CustomsDeclarationClearedEvent {
  declarationId: string;
  code: string;
  containerId: string;
  totalPayable: number;
}

/** Emitted when a customs channel is assigned. Event: `customs.declaration.channel.assigned` */
export interface CustomsChannelAssignedEvent {
  declarationId: string;
  code: string;
  containerId: string;
  channel: string;
  assignedBy: string;
}

/** Emitted when compliance is checked. Event: `customs.compliance.checked` */
export interface CustomsComplianceCheckedEvent {
  declarationId: string;
  code: string;
  alertCount: number;
  complianceStatus?: string;
  checkedBy: string;
}

// ─── Approval Events ────────────────────────────────────────────────────────

/** Emitted when an approval is submitted. Event: `approval.submitted` */
export interface ApprovalSubmittedEvent {
  approvalId: string;
  type: string;
  requesterId: string;
  approverIds: string[];
}

// ─── Leave Events ───────────────────────────────────────────────────────────

/** Emitted when a leave request is created. Event: `leave.requested` */
export interface LeaveRequestedEvent {
  leaveId: string;
  employeeId: string;
  type: string;
  totalDays: number;
}

/** Emitted when a leave request is approved. Event: `leave.approved` */
export interface LeaveApprovedEvent {
  leaveId: string;
  employeeId: string;
  approverId: string;
}

// ─── Warehouse Events ───────────────────────────────────────────────────────

/** Emitted when a package is received at CN warehouse. Event: `package.received.cn` */
export interface PackageReceivedCNEvent {
  packageId: string;
  orderId: string;
  trackingNumberCN?: string;
  receivedBy: string;
}

/** Emitted when a package is received at VN warehouse. Event: `package.received.vn` */
export interface PackageReceivedVNEvent {
  packageId: string;
  orderId: string;
  receivedBy: string;
}

/** Emitted when a delivery is completed. Event: `delivery.completed` */
export interface DeliveryCompletedEvent {
  deliveryId: string;
  driverId: string;
  completedAt: Date;
}

// ─── Dashboard / Internal Events ────────────────────────────────────────────

/** Emitted to trigger dashboard metric updates. Event: `dashboard.update` */
export interface DashboardUpdateEvent {
  type: string;
  data: Record<string, unknown>;
}

/** Emitted to send a notification to a specific user. Event: `notification.send` */
export interface NotificationSendEvent {
  userId: string;
  title: string;
  body: string;
  type: string;
  referenceId?: string;
}

// ─── Event Name Constants ───────────────────────────────────────────────────

/**
 * String constants for EventEmitter2 event names.
 * Use these instead of hardcoded strings to enable refactoring and search.
 */
export const EventNames = {
  // Order
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCEL_REQUESTED: 'order.cancel.requested',
  ORDER_CANCELLED: 'order.cancelled',

  // Finance
  PAYMENT_RECEIVED: 'payment.received',
  VOUCHER_CREATED: 'voucher.created',
  VOUCHER_APPROVED: 'voucher.approved',
  VOUCHER_REJECTED: 'voucher.rejected',
  AR_PAYMENT_RECEIVED: 'ar.payment.received',

  // Commission
  COMMISSION_PENDING: 'commission.pending',
  COMMISSION_APPROVED: 'commission.approved',

  // Customs
  CUSTOMS_DECLARATION_CREATED: 'customs.declaration.created',
  CUSTOMS_DECLARATION_STATUS_CHANGED: 'customs.declaration.status.changed',
  CUSTOMS_DECLARATION_CLEARED: 'customs.declaration.cleared',
  CUSTOMS_DECLARATION_REJECTED: 'customs.declaration.rejected',
  CUSTOMS_CHANNEL_ASSIGNED: 'customs.declaration.channel.assigned',
  CUSTOMS_COMPLIANCE_CHECKED: 'customs.compliance.checked',

  // Approval
  APPROVAL_SUBMITTED: 'approval.submitted',

  // Leave
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',

  // Warehouse
  PACKAGE_RECEIVED_CN: 'package.received.cn',
  PACKAGE_RECEIVED_VN: 'package.received.vn',
  DELIVERY_COMPLETED: 'delivery.completed',

  // Dashboard / Notification
  DASHBOARD_UPDATE: 'dashboard.update',
  NOTIFICATION_SEND: 'notification.send',
} as const;
