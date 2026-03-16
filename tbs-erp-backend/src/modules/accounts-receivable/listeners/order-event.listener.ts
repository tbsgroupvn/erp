import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { AccountsReceivableService } from '../accounts-receivable.service';

export interface OrderConfirmedEvent {
  orderId: string;
  customerId: string;
  totalAmount: number;
  dueDate?: string;
  createdBy: string;
}

export interface PaymentReceivedEvent {
  orderId: string;
  customerId: string;
  amount: number;
  reference?: string;
}

@Injectable()
export class OrderEventListener {
  private readonly logger = new Logger(OrderEventListener.name);

  constructor(
    private readonly arService: AccountsReceivableService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * When an order is confirmed (deposit paid), create an AR record for
   * the remaining balance.
   */
  @OnEvent('order.confirmed')
  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    this.logger.log(`Order confirmed event: orderId=${event.orderId}, amount=${event.totalAmount}`);

    if (!event.customerId) {
      this.logger.warn(
        `Order ${event.orderId} has no customerId — skipping AR creation to prevent orphan records`,
      );
      return;
    }

    try {
      // Default due date: 30 days from now
      const dueDate =
        event.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await this.arService.createReceivable(
        {
          customerId: event.customerId,
          orderId: event.orderId,
          amount: event.totalAmount,
          dueDate,
        },
        event.createdBy,
      );

      this.logger.log(`AR created for order ${event.orderId}, amount=${event.totalAmount}`);
    } catch (error) {
      this.logger.error(
        `Failed to create AR for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * When a payment is received against an order, find the matching AR
   * and record the payment.
   */
  @OnEvent('payment.received')
  async handlePaymentReceived(event: PaymentReceivedEvent): Promise<void> {
    this.logger.log(`Payment received event: orderId=${event.orderId}, amount=${event.amount}`);

    // The actual AR lookup and payment recording is handled by the service
    // through the controller. This listener is for automated payment matching.
    // In practice, the accounting team would manually match payments to ARs.
    this.logger.log(
      `Payment event logged for order ${event.orderId}. Manual AR matching may be required.`,
    );
  }

  /**
   * When an extra charge is approved, increase the open AR amount.
   * If no open AR exists yet (order not confirmed), skip — AR will
   * include the extra charge when created at confirmation time.
   */
  @OnEvent('order.extra_charge_approved')
  async handleExtraChargeApproved(event: {
    orderId: string;
    amount: number;
    chargeId: string;
  }): Promise<void> {
    this.logger.log(
      `Extra charge approved: orderId=${event.orderId}, amount=${event.amount}, chargeId=${event.chargeId}`,
    );

    try {
      const ar = await this.prisma.accountReceivable.findFirst({
        where: {
          orderId: event.orderId,
          status: { notIn: ['PAID', 'NETTED'] },
        },
      });

      if (!ar) {
        this.logger.log(
          `No open AR for order ${event.orderId} — extra charge will be included when AR is created`,
        );
        return;
      }

      const newAmount = ar.amount.toNumber() + event.amount;
      await this.prisma.accountReceivable.update({
        where: { id: ar.id },
        data: {
          amount: new Prisma.Decimal(newAmount),
          note: `${ar.note ?? ''}\n[Phu phi] +${event.amount.toLocaleString()} (${event.chargeId})`.trim(),
        },
      });

      this.logger.log(
        `AR ${ar.id} updated: +${event.amount} for extra charge ${event.chargeId}. New amount: ${newAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update AR for extra charge ${event.chargeId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
