import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Currency, MHHIssueResolution } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { NotificationService } from '@modules/notification/notification.service';
import { OrderStatusService } from '../order-status.service';

export interface MhhIssueResolvedEvent {
  issueId: string;
  code: string;
  orderId: string;
  resolution: MHHIssueResolution;
  resolutionNote?: string;
  compensationAmount?: number;
  compensationCurrency?: Currency;
  resolvedBy: string;
}

@Injectable()
export class MhhIssueResolutionListener {
  private readonly logger = new Logger(MhhIssueResolutionListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly notificationService: NotificationService,
    private readonly orderStatusService: OrderStatusService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('mhh-issue.resolved')
  async handleMhhIssueResolved(event: MhhIssueResolvedEvent): Promise<void> {
    this.logger.log(
      `MHH Issue ${event.code} resolved: resolution=${event.resolution}, ` +
        `compensation=${event.compensationAmount ?? 'none'}`,
    );

    try {
      switch (event.resolution) {
        case MHHIssueResolution.REFUND:
          await this.handleRefund(event);
          break;
        case MHHIssueResolution.CANCEL_ITEM:
          await this.handleCancelItem(event);
          break;
        case MHHIssueResolution.REPLACE:
          await this.handleReplace(event);
          break;
        default:
          this.logger.warn(`Unknown resolution type: ${event.resolution}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process MHH Issue resolution ${event.code}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * REFUND: Convert CNY→VND, credit customer wallet, adjust order totalAmount,
   * trigger commission clawback.
   */
  private async handleRefund(event: MhhIssueResolvedEvent): Promise<void> {
    if (!event.compensationAmount || event.compensationAmount <= 0) {
      this.logger.warn(`MHH Issue ${event.code}: REFUND without compensation amount, skipping`);
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: {
        id: true,
        code: true,
        customerId: true,
        baseExchangeRate: true,
        exchangeRateMode: true,
        totalAmount: true,
      },
    });

    if (!order) {
      this.logger.error(`Order ${event.orderId} not found for MHH refund`);
      return;
    }

    // Determine exchange rate: FIXED uses order's baseExchangeRate, FLOATING uses current rate
    let exchangeRate: number;
    const compensationCurrency = event.compensationCurrency ?? Currency.CNY;

    if (compensationCurrency === Currency.VND) {
      exchangeRate = 1;
    } else if (order.exchangeRateMode === 'FIXED' && order.baseExchangeRate) {
      exchangeRate = Number(order.baseExchangeRate);
    } else {
      const rate = await this.exchangeRateService.getCurrentRate(Currency.CNY, Currency.VND);
      exchangeRate = Number(rate.rate);
    }

    const refundVND = event.compensationAmount * exchangeRate;

    // Credit customer wallet
    const refundResult = await this.walletService.refund(
      order.customerId,
      refundVND,
      event.code,
      `Hoan tien MHH Issue ${event.code} - ${event.resolutionNote ?? 'hang loi'}`,
    );

    this.logger.log(
      `Wallet credited for customer ${order.customerId}: ${refundVND} VND ` +
        `(${event.compensationAmount} ${compensationCurrency} * ${exchangeRate}) from ${event.code}`,
    );

    // Adjust order totalAmount
    const currentTotal = Number(order.totalAmount);
    const newTotal = Math.max(0, currentTotal - refundVND);

    await this.prisma.order.update({
      where: { id: order.id },
      data: { totalAmount: newTotal },
    });

    this.logger.log(
      `Order ${order.code} totalAmount adjusted: ${currentTotal} -> ${newTotal} VND (MHH refund)`,
    );

    // Trigger commission clawback
    this.eventEmitter.emit('order.commission.clawback', {
      orderId: order.id,
      reason:
        `MHH Issue ${event.code} refund: ${event.compensationAmount} ${compensationCurrency} ` +
        `= ${refundVND} VND. Order total: ${currentTotal} -> ${newTotal} VND`,
      triggeredBy: event.resolvedBy,
    });

    // Emit event for auto-clear AR
    this.eventEmitter.emit('wallet.credited.mhh-refund', {
      customerId: order.customerId,
      amount: refundVND,
      newBalance: refundResult.wallet.balance.toNumber(),
      source: 'MHH_REFUND',
      mhhIssueCode: event.code,
      transactionId: refundResult.transaction.id,
    });
  }

  /**
   * CANCEL_ITEM: Reduce order item quantity and recalculate order totalAmount.
   * compensationAmount is used as the number of items to cancel.
   */
  private async handleCancelItem(event: MhhIssueResolvedEvent): Promise<void> {
    // Get MHH Issue details for orderItemId
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id: event.issueId },
      select: { orderItemId: true },
    });

    if (!issue?.orderItemId) {
      this.logger.error(
        `MHH Issue ${event.code}: CANCEL_ITEM requires orderItemId, but none found`,
      );
      return;
    }

    const cancelledQty = event.compensationAmount ?? 0;
    if (cancelledQty <= 0) {
      this.logger.warn(`MHH Issue ${event.code}: CANCEL_ITEM with 0 quantity, skipping`);
      return;
    }

    // Get current item quantity
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: issue.orderItemId },
      select: { quantity: true },
    });

    if (!orderItem) {
      this.logger.error(`OrderItem ${issue.orderItemId} not found for CANCEL_ITEM`);
      return;
    }

    const newQuantity = orderItem.quantity - cancelledQty;
    if (newQuantity < 0) {
      this.logger.error(
        `MHH Issue ${event.code}: cancelledQty (${cancelledQty}) exceeds current qty (${orderItem.quantity})`,
      );
      return;
    }

    await this.orderStatusService.adjustOrderItemQuantity(
      event.orderId,
      issue.orderItemId,
      newQuantity,
      `MHH Issue ${event.code}: huy ${cancelledQty} san pham loi`,
      event.resolvedBy,
    );

    this.logger.log(
      `MHH Issue ${event.code}: cancelled ${cancelledQty} items, new qty = ${newQuantity}`,
    );
  }

  /**
   * REPLACE: Notify warehouse and CSKH about incoming replacement goods.
   */
  private async handleReplace(event: MhhIssueResolvedEvent): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: { id: true, code: true, saleId: true },
    });

    if (!order) {
      this.logger.error(`Order ${event.orderId} not found for REPLACE notification`);
      return;
    }

    const notification = {
      title: 'Hang thay the dang ve',
      body:
        `MHH Issue ${event.code}: NCC dong y doi hang. ` +
        `Don ${order.code} - Can theo doi kien hang moi.`,
      type: 'ORDER',
      referenceId: event.orderId,
      isUrgent: false,
    };

    await this.notificationService.sendToRole('WAREHOUSE_CN_AGENT', notification);
    await this.notificationService.sendToRole('CSKH', notification);

    if (order.saleId) {
      await this.notificationService.send({
        userId: order.saleId,
        ...notification,
      });
    }

    this.logger.log(`MHH Issue ${event.code}: REPLACE notifications sent for order ${order.code}`);
  }
}
