import { Currency, PaymentMethod } from '@prisma/client';

/**
 * Base class for all payment-related events.
 */
abstract class BasePaymentEvent {
  readonly timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when a payment is received from a customer.
 */
export class PaymentReceivedEvent extends BasePaymentEvent {
  static readonly EVENT_NAME = 'payment.received';

  constructor(
    public readonly transactionId: string,
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly amount: number,
    public readonly currency: Currency,
    public readonly paymentMethod: PaymentMethod,
    public readonly receivedBy: string,
  ) {
    super();
  }
}

/**
 * Emitted when a deposit is paid for an order.
 */
export class DepositPaidEvent extends BasePaymentEvent {
  static readonly EVENT_NAME = 'payment.deposit.paid';

  constructor(
    public readonly orderId: string,
    public readonly orderCode: string,
    public readonly customerId: string,
    public readonly depositAmount: number,
    public readonly totalRequired: number,
    public readonly currency: Currency,
    public readonly isFullyPaid: boolean,
  ) {
    super();
  }
}

/**
 * Emitted when a payment voucher is approved.
 */
export class PaymentVoucherApprovedEvent extends BasePaymentEvent {
  static readonly EVENT_NAME = 'payment.voucher.approved';

  constructor(
    public readonly voucherId: string,
    public readonly voucherCode: string,
    public readonly orderId: string,
    public readonly type: 'RECEIPT' | 'PAYMENT',
    public readonly amount: number,
    public readonly currency: Currency,
    public readonly approvedBy: string,
  ) {
    super();
  }
}
