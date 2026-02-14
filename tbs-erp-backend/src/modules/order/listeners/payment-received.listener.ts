import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderService } from '../order.service';

export interface PaymentReceivedEvent {
  orderId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
}

/**
 * Listens for payment.received events and updates the order's deposit status.
 *
 * When a payment is received:
 *  1. Updates the order's depositPaid amount
 *  2. Checks if the deposit requirement is now satisfied
 *  3. If satisfied, the order can proceed through the deposit gate
 */
@Injectable()
export class PaymentReceivedListener {
  private readonly logger = new Logger(PaymentReceivedListener.name);

  constructor(private readonly orderService: OrderService) {}

  @OnEvent('payment.received')
  async handlePaymentReceived(event: PaymentReceivedEvent): Promise<void> {
    this.logger.log(
      `Payment received for order ${event.orderId}: amount=${event.amount}, method=${event.paymentMethod}`,
    );

    try {
      const result = await this.orderService.updateDepositPayment(
        event.orderId,
        event.amount,
      );

      if (result.isDepositPaid) {
        this.logger.log(
          `Deposit requirement satisfied for order ${event.orderId}. Order can proceed to SOURCING.`,
        );
      } else {
        this.logger.log(
          `Deposit partially paid for order ${event.orderId}: ${result.depositPaid} paid so far.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
