import { OrderStatus, ServiceType, Branch } from '@prisma/client';

/**
 * Base class for all order-related events.
 */
abstract class BaseOrderEvent {
  /** Timestamp when the event was created */
  readonly timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when a new order is created.
 */
export class OrderCreatedEvent extends BaseOrderEvent {
  static readonly EVENT_NAME = 'order.created';

  constructor(
    public readonly orderId: string,
    public readonly orderCode: string,
    public readonly customerId: string,
    public readonly saleId: string,
    public readonly serviceType: ServiceType,
    public readonly branch: Branch,
    public readonly totalAmount: number,
  ) {
    super();
  }
}

/**
 * Emitted when an order's status changes.
 */
export class OrderStatusChangedEvent extends BaseOrderEvent {
  static readonly EVENT_NAME = 'order.status.changed';

  constructor(
    public readonly orderId: string,
    public readonly orderCode: string,
    public readonly fromStatus: OrderStatus | null,
    public readonly toStatus: OrderStatus,
    public readonly changedBy: string,
    public readonly note?: string,
  ) {
    super();
  }
}

/**
 * Emitted when an order is cancelled.
 */
export class OrderCancelledEvent extends BaseOrderEvent {
  static readonly EVENT_NAME = 'order.cancelled';

  constructor(
    public readonly orderId: string,
    public readonly orderCode: string,
    public readonly customerId: string,
    public readonly saleId: string,
    public readonly cancelledBy: string,
    public readonly cancelReason: string,
    public readonly depositPaid: number,
  ) {
    super();
  }
}
