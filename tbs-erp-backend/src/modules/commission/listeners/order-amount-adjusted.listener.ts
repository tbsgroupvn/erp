import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';

export interface OrderAmountAdjustedEvent {
  orderId: string;
  orderCode: string;
  previousAmount: number;
  newAmount: number;
  deltaAmount: number;
  reason: string;
  triggeredBy: string;
  orderItemId: string;
}

@Injectable()
export class OrderAmountAdjustedListener {
  private readonly logger = new Logger(OrderAmountAdjustedListener.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('order.amount.adjusted')
  async handleOrderAmountAdjusted(event: OrderAmountAdjustedEvent): Promise<void> {
    // Only trigger clawback when totalAmount decreased
    if (event.deltaAmount >= 0) {
      this.logger.debug(
        `Order ${event.orderCode} amount increased or unchanged, skipping commission clawback`,
      );
      return;
    }

    this.logger.log(
      `Order ${event.orderCode} amount decreased: ${event.previousAmount} -> ${event.newAmount} VND. ` +
        `Triggering commission clawback.`,
    );

    this.eventEmitter.emit('order.commission.clawback', {
      orderId: event.orderId,
      reason:
        `Don hang ${event.orderCode} dieu chinh gia tri: ` +
        `${event.previousAmount} -> ${event.newAmount} VND. Ly do: ${event.reason}`,
      triggeredBy: event.triggeredBy,
    });
  }
}
