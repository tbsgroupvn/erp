import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  DomainEventType,
  OrderCreatedPayload,
  OrderStatusChangedPayload,
} from '../domain-events';
import { logProcessorError } from './processor-error.util';

/**
 * Processes order-related domain events from the 'order-events' BullMQ queue.
 *
 * Responsibilities:
 * - Forward events to in-process EventEmitter for sync listeners
 * - Trigger cross-domain side effects (notifications, dashboard updates)
 * - All processing is idempotent (safe to retry)
 */
@Processor('order-events')
export class OrderEventProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderEventProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;
    this.logger.log(
      `Processing ${event.type} (jobId: ${job.id}, ` +
        `correlationId: ${event.metadata.correlationId})`,
    );

    try {
      switch (event.type) {
        case DomainEventType.ORDER_CREATED:
          await this.handleOrderCreated(event as DomainEvent<OrderCreatedPayload>);
          break;

        case DomainEventType.ORDER_STATUS_CHANGED:
          await this.handleOrderStatusChanged(event as DomainEvent<OrderStatusChangedPayload>);
          break;

        case DomainEventType.ORDER_CANCELLED:
          await this.handleOrderCancelled(event);
          break;

        case DomainEventType.ORDER_COMPLETED:
          await this.handleOrderCompleted(event);
          break;

        case DomainEventType.ORDER_DEPOSIT_RECEIVED:
          await this.handleDepositReceived(event);
          break;

        default:
          this.logger.warn(`Unhandled order event type: ${event.type}`);
      }
    } catch (error) {
      logProcessorError(this.logger, job, error);
      throw error; // Re-throw so BullMQ can retry
    }
  }

  /**
   * Handle ORDER_CREATED:
   * 1. Notify the assigned sales person
   * 2. Emit in-process event for dashboard metric updates
   * 3. Trigger integration sync if configured
   */
  private async handleOrderCreated(event: DomainEvent<OrderCreatedPayload>): Promise<void> {
    const { orderId, orderCode, salesPersonId, customerId, totalAmount } = event.payload;

    this.logger.log(`Order created: ${orderCode} (ID: ${orderId}, amount: ${totalAmount})`);

    // 1. Emit notification event for sales person
    if (salesPersonId) {
      this.eventEmitter.emit('notification.send', {
        userId: salesPersonId,
        title: 'Don hang moi',
        body: `Don hang ${orderCode} da duoc tao thanh cong. Tong gia tri: ${totalAmount.toLocaleString()} VND`,
        type: 'ORDER_CREATED',
        referenceId: orderId,
      });
    }

    // 2. Update dashboard metrics via in-process event
    this.eventEmitter.emit('dashboard.update', {
      type: 'ORDER_CREATED',
      data: { orderId, totalAmount },
    });

    // 3. Forward to integration sync
    this.eventEmitter.emit('integration.order.created', {
      orderId,
      orderCode,
      customerId,
    });
  }

  /**
   * Handle ORDER_STATUS_CHANGED:
   * 1. Notify the customer
   * 2. Update tracking information
   * 3. Trigger warehouse actions if applicable
   */
  private async handleOrderStatusChanged(
    event: DomainEvent<OrderStatusChangedPayload>,
  ): Promise<void> {
    const { orderId, orderCode, previousStatus, newStatus, customerId, changedBy } = event.payload;

    this.logger.log(`Order ${orderCode} status changed: ${previousStatus} -> ${newStatus}`);

    // 1. Notify the customer about the status change
    this.eventEmitter.emit('notification.send', {
      userId: customerId,
      title: 'Cap nhat trang thai don hang',
      body: `Don hang ${orderCode} da chuyen trang thai tu ${previousStatus} sang ${newStatus}`,
      type: 'ORDER_STATUS_CHANGED',
      referenceId: orderId,
    });

    // 2. Update tracking events
    this.eventEmitter.emit('tracking.status.updated', {
      orderId,
      status: newStatus,
      previousStatus,
      changedBy,
    });

    // 3. Dashboard real-time update
    this.eventEmitter.emit('dashboard.update', {
      type: 'ORDER_STATUS_CHANGED',
      data: { orderId, previousStatus, newStatus },
    });

    // 4. Real-time order_update event — invalidates the order list and detail
    //    cache on the frontend for the customer and the sales person.
    this.eventEmitter.emit('ws.emit.user', {
      userId: customerId,
      event: 'order_update',
      data: { orderId, orderCode, previousStatus, newStatus },
    });
  }

  private async handleOrderCancelled(event: DomainEvent): Promise<void> {
    this.logger.log(`Order cancelled: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('dashboard.update', {
      type: 'ORDER_CANCELLED',
      data: { orderId: event.metadata.aggregateId },
    });

    // Notify any listener watching this order that it has been cancelled.
    this.eventEmitter.emit('ws.emit.user', {
      userId: event.metadata.userId,
      event: 'order_update',
      data: { orderId: event.metadata.aggregateId, newStatus: 'CANCELLED' },
    });
  }

  private async handleOrderCompleted(event: DomainEvent): Promise<void> {
    this.logger.log(`Order completed: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('dashboard.update', {
      type: 'ORDER_COMPLETED',
      data: { orderId: event.metadata.aggregateId },
    });

    // Notify any listener watching this order that it has completed.
    this.eventEmitter.emit('ws.emit.user', {
      userId: event.metadata.userId,
      event: 'order_update',
      data: { orderId: event.metadata.aggregateId, newStatus: 'COMPLETED' },
    });
  }

  private async handleDepositReceived(event: DomainEvent): Promise<void> {
    this.logger.log(`Deposit received for order: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('finance.deposit.processed', {
      orderId: event.metadata.aggregateId,
      ...event.payload,
    });
  }
}
