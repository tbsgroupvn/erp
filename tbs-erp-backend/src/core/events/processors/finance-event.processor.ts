import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  DomainEventType,
  PaymentReceivedPayload,
} from '../domain-events';
import { CostAllocationService } from '@modules/operation-cost/domain/cost-allocation.service';

/**
 * Processes finance-related domain events from the 'finance-events' queue.
 *
 * Handles:
 * - Payment received / allocated
 * - Invoice issued
 * - Voucher approved / rejected
 * - AR overdue alerts
 *
 * All processing is idempotent.
 */
@Processor('finance-events')
export class FinanceEventProcessor extends WorkerHost {
  private readonly logger = new Logger(FinanceEventProcessor.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly costAllocation: CostAllocationService,
  ) {
    super();
  }

  async process(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;
    this.logger.log(
      `Processing ${event.type} (jobId: ${job.id}, ` +
      `correlationId: ${event.metadata.correlationId})`,
    );

    switch (event.type) {
      case DomainEventType.PAYMENT_RECEIVED:
        await this.handlePaymentReceived(event as DomainEvent<PaymentReceivedPayload>);
        break;

      case DomainEventType.PAYMENT_ALLOCATED:
        await this.handlePaymentAllocated(event);
        break;

      case DomainEventType.INVOICE_ISSUED:
        await this.handleInvoiceIssued(event);
        break;

      case DomainEventType.VOUCHER_APPROVED:
        await this.handleVoucherApproved(event);
        break;

      case DomainEventType.VOUCHER_REJECTED:
        await this.handleVoucherRejected(event);
        break;

      case DomainEventType.AR_OVERDUE:
        await this.handleArOverdue(event);
        break;

      case 'cost-allocation':
        await this.handleCostAllocation(job);
        break;

      default:
        this.logger.warn(`Unhandled finance event type: ${event.type}`);
    }
  }

  /**
   * Handle PAYMENT_RECEIVED:
   * 1. Forward to order module for deposit gate check
   * 2. Update dashboard finance metrics
   * 3. Notify relevant accountant
   */
  private async handlePaymentReceived(
    event: DomainEvent<PaymentReceivedPayload>,
  ): Promise<void> {
    const { paymentId, orderId, amount, customerId } = event.payload;

    this.logger.log(
      `Payment received: ${paymentId} for order ${orderId}, amount: ${amount}`,
    );

    // 1. Forward to order module for deposit gate evaluation
    this.eventEmitter.emit('order.payment.received', {
      paymentId,
      orderId,
      amount,
      customerId,
    });

    // 2. Dashboard update
    this.eventEmitter.emit('dashboard.update', {
      type: 'PAYMENT_RECEIVED',
      data: { paymentId, orderId, amount },
    });

    // 3. WebSocket real-time update for finance dashboard
    this.eventEmitter.emit('ws.emit.role', {
      role: 'ACCOUNTANT',
      event: 'finance_update',
      data: { type: 'PAYMENT_RECEIVED', paymentId, amount },
    });
  }

  private async handlePaymentAllocated(event: DomainEvent): Promise<void> {
    this.logger.log(`Payment allocated: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('dashboard.update', {
      type: 'PAYMENT_ALLOCATED',
      data: event.payload,
    });
  }

  private async handleInvoiceIssued(event: DomainEvent): Promise<void> {
    const { invoiceId, customerId, amount } = event.payload as any;
    this.logger.log(`Invoice issued: ${invoiceId}, amount: ${amount}`);

    // Notify customer
    this.eventEmitter.emit('notification.dispatch', {
      userId: customerId,
      title: 'Hoa don moi',
      body: `Hoa don #${invoiceId} da duoc phat hanh. So tien: ${amount?.toLocaleString?.()} VND`,
      type: 'INVOICE_ISSUED',
      referenceId: invoiceId,
    });
  }

  private async handleVoucherApproved(event: DomainEvent): Promise<void> {
    const { voucherId, requesterId } = event.payload as any;
    this.logger.log(`Voucher approved: ${voucherId}`);

    this.eventEmitter.emit('ws.emit.user', {
      userId: requesterId,
      event: 'voucher_approved',
      data: { voucherId },
    });
  }

  private async handleVoucherRejected(event: DomainEvent): Promise<void> {
    const { voucherId, requesterId, reason } = event.payload as any;
    this.logger.log(`Voucher rejected: ${voucherId}, reason: ${reason}`);

    this.eventEmitter.emit('ws.emit.user', {
      userId: requesterId,
      event: 'voucher_rejected',
      data: { voucherId, reason },
    });
  }

  private async handleArOverdue(event: DomainEvent): Promise<void> {
    this.logger.log(`AR overdue alert: ${event.metadata.aggregateId}`);

    // Notify accountants and sales managers
    this.eventEmitter.emit('ws.emit.role', {
      role: 'ACCOUNTANT',
      event: 'ar_overdue',
      data: event.payload,
    });
  }

  private async handleCostAllocation(job: Job): Promise<void> {
    const { costId, containerId, containerCode, allocationMethod } = job.data as any;
    this.logger.log(
      `Processing cost allocation for container ${containerCode} (cost ${costId}, method: ${allocationMethod})`,
    );

    try {
      switch (allocationMethod) {
        case 'VOLUME':
          await this.costAllocation.allocateByVolume(containerId);
          break;
        case 'EVEN':
          await this.costAllocation.allocateEvenly(containerId);
          break;
        case 'WEIGHT':
        default:
          await this.costAllocation.allocateByWeight(containerId);
          break;
      }

      this.logger.log(
        `Cost allocation completed for container ${containerCode} (cost ${costId})`,
      );
    } catch (error) {
      this.logger.error(
        `Cost allocation failed for container ${containerCode}: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ retry
    }
  }
}
