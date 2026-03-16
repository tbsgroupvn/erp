import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Currency } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { ShortfallClosedEvent } from './fulfillment-tracking.listener';

@Injectable()
export class ShortfallWalletCreditListener {
  private readonly logger = new Logger(ShortfallWalletCreditListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('supplier-order.shortfall.closed')
  async onShortfallClosed(event: ShortfallClosedEvent): Promise<void> {
    this.logger.log(
      `Shortfall wallet credit: processing ${event.code}, refund ${event.supplierRefundCNY} CNY`,
    );

    try {
      if (event.supplierRefundCNY <= 0) {
        this.logger.log(`No refund amount for ${event.code}, skipping wallet credit`);
        return;
      }

      // Get order with customer info and exchange rate mode
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
        this.logger.error(`Order ${event.orderId} not found for shortfall wallet credit`);
        return;
      }

      // Determine exchange rate: FIXED uses order's baseExchangeRate, FLOATING uses current rate
      let exchangeRate: number;

      if (order.exchangeRateMode === 'FIXED' && order.baseExchangeRate) {
        exchangeRate = Number(order.baseExchangeRate);
      } else {
        const rate = await this.exchangeRateService.getCurrentRate(Currency.CNY, Currency.VND);
        exchangeRate = Number(rate.rate);
      }

      const refundVND = event.supplierRefundCNY * exchangeRate;

      // Credit wallet
      const note =
        `Hoan tien NCC giao thieu ${event.shortfallQty} kien - ${event.code}`;

      const refundResult = await this.walletService.refund(
        order.customerId,
        refundVND,
        event.code,
        note,
      );

      this.logger.log(
        `Wallet credited for customer ${order.customerId}: ${refundVND} VND ` +
          `(${event.supplierRefundCNY} CNY * ${exchangeRate}) from ${event.code}`,
      );

      // Emit event for auto-clear AR
      this.eventEmitter.emit('wallet.credited.supplier-refund', {
        customerId: order.customerId,
        amount: refundVND,
        newBalance: refundResult.wallet.balance.toNumber(),
        source: 'SUPPLIER_REFUND',
        supplierOrderCode: event.code,
        transactionId: refundResult.transaction.id,
      });

      // Adjust order totalAmount
      // shortfallQty * unitPrice needs supplier order info
      // Using supplierRefundCNY * exchangeRate as the adjustment amount
      const adjustmentVND = refundVND;

      if (adjustmentVND > 0) {
        const currentTotal = Number(order.totalAmount);
        const newTotal = Math.max(0, currentTotal - adjustmentVND);

        await this.prisma.order.update({
          where: { id: order.id },
          data: { totalAmount: newTotal },
        });

        this.logger.log(
          `Order ${order.code} totalAmount adjusted: ${currentTotal} -> ${newTotal} VND ` +
            `(shortfall deduction ${adjustmentVND} VND)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process shortfall wallet credit for ${event.code}: ${error.message}`,
        error.stack,
      );
    }
  }
}
