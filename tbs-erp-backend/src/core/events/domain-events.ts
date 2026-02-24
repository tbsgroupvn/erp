/**
 * Domain Event types used throughout the TBS ERP system.
 *
 * Convention: `<aggregate>.<action>` using dot-delimited namespaces.
 * BullMQ queues are mapped by the first segment (order, finance, warehouse, etc.).
 */
export enum DomainEventType {
  // ─── Order Events ───
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status.changed',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_COMPLETED = 'order.completed',
  ORDER_DEPOSIT_RECEIVED = 'order.deposit.received',

  // ─── Finance Events ───
  PAYMENT_RECEIVED = 'finance.payment.received',
  PAYMENT_ALLOCATED = 'finance.payment.allocated',
  INVOICE_ISSUED = 'finance.invoice.issued',
  VOUCHER_APPROVED = 'finance.voucher.approved',
  VOUCHER_REJECTED = 'finance.voucher.rejected',
  AR_OVERDUE = 'finance.ar.overdue',

  // ─── Warehouse Events ───
  PACKAGE_RECEIVED_CN = 'warehouse.package.received.cn',
  PACKAGE_SHIPPED_CN = 'warehouse.package.shipped.cn',
  PACKAGE_IN_TRANSIT = 'warehouse.package.in_transit',
  PACKAGE_AT_CUSTOMS = 'warehouse.package.at_customs',
  PACKAGE_RECEIVED_VN = 'warehouse.package.received.vn',
  PACKAGE_DELIVERED = 'warehouse.package.delivered',
  INVENTORY_UPDATED = 'warehouse.inventory.updated',

  // ─── Notification Events ───
  NOTIFICATION_SEND = 'notification.send',
  NOTIFICATION_BROADCAST = 'notification.broadcast',
  NOTIFICATION_EMAIL = 'notification.email',
  NOTIFICATION_SMS = 'notification.sms',

  // ─── Integration Events ───
  INTEGRATION_SYNC = 'integration.sync',
  INTEGRATION_WEBHOOK = 'integration.webhook',
  INTEGRATION_EXPORT = 'integration.export',

  // ─── Approval Events ───
  APPROVAL_REQUESTED = 'approval.requested',
  APPROVAL_APPROVED = 'approval.approved',
  APPROVAL_REJECTED = 'approval.rejected',

  // ─── CRM Events ───
  CUSTOMER_CREATED = 'crm.customer.created',
  CUSTOMER_TIER_CHANGED = 'crm.customer.tier.changed',
}

/**
 * Base interface for all domain events published through BullMQ.
 *
 * @template T - The shape of the event payload (specific to each event type)
 */
export interface DomainEvent<T = any> {
  /** The event type identifier */
  type: DomainEventType;

  /** Event-specific payload */
  payload: T;

  /** Metadata for tracing, auditing, and debugging */
  metadata: {
    /** ID of the user who triggered the event */
    userId: string;
    /** ISO timestamp of when the event was created */
    timestamp: Date;
    /** Correlation ID for distributed tracing (usually the request ID) */
    correlationId: string;
    /** Source module/service that emitted the event */
    source: string;
    /** Optional: ID of the affected aggregate (order ID, payment ID, etc.) */
    aggregateId?: string;
    /** Optional: version for optimistic concurrency control */
    version?: number;
  };
}

// ─── Typed Event Payloads ───

export interface OrderCreatedPayload {
  orderId: string;
  orderCode: string;
  customerId: string;
  serviceType: string;
  totalAmount: number;
  branch?: string;
  salesPersonId?: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  orderCode: string;
  previousStatus: string;
  newStatus: string;
  customerId: string;
  changedBy: string;
}

export interface PaymentReceivedPayload {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  customerId: string;
}

export interface PackageReceivedPayload {
  packageId: string;
  trackingCode: string;
  orderId: string;
  warehouse: 'CN' | 'VN';
  weight?: number;
}

export interface NotificationSendPayload {
  userId: string;
  title: string;
  body: string;
  type?: string;
  channel?: string;
  referenceId?: string;
  isUrgent?: boolean;
  data?: Record<string, unknown>;
}

export interface NotificationBroadcastPayload {
  targetRole?: string;
  targetBranch?: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
}
