import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutoClearArService } from '../auto-clear-ar.service';

interface WalletTopupEvent {
  customerId: string;
  amount: number;
  newBalance: number;
}

interface WalletAutoTopupEvent {
  customerId: string;
  amount: number;
  newBalance: number;
}

interface WalletCreditedSupplierRefundEvent {
  customerId: string;
  amount: number;
  newBalance: number;
  source: string;
  supplierOrderCode: string;
  transactionId: string;
}

interface WalletCreditedCarrierCodEvent {
  customerId: string;
  amount: number;
  newBalance: number;
  carrierName: string;
  deliveryCode: string;
  reconCode: string;
}

@Injectable()
export class AutoClearArListener {
  private readonly logger = new Logger(AutoClearArListener.name);

  constructor(
    private readonly autoClearService: AutoClearArService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('wallet.topup')
  async onWalletTopup(event: WalletTopupEvent): Promise<void> {
    await this.executeAutoClear(event.customerId, 'Nap vi thu cong');
  }

  @OnEvent('wallet.auto.topup')
  async onWalletAutoTopup(event: WalletAutoTopupEvent): Promise<void> {
    await this.executeAutoClear(event.customerId, 'Webhook auto nap vi');
  }

  @OnEvent('wallet.credited.supplier-refund')
  async onSupplierRefund(event: WalletCreditedSupplierRefundEvent): Promise<void> {
    await this.executeAutoClear(
      event.customerId,
      `Hoan tien NCC - ${event.supplierOrderCode}`,
    );
  }

  @OnEvent('wallet.credited.carrier-cod')
  async onCarrierCod(event: WalletCreditedCarrierCodEvent): Promise<void> {
    await this.executeAutoClear(
      event.customerId,
      `COD doi soat - ${event.carrierName} - ${event.reconCode}`,
    );
  }

  private async executeAutoClear(customerId: string, triggerSource: string): Promise<void> {
    try {
      this.logger.log(
        `Auto-clear AR triggered for customer ${customerId}, source: ${triggerSource}`,
      );

      const result = await this.autoClearService.autoClear(customerId, triggerSource);

      if (result.clearedRecords.length === 0) {
        this.logger.log(`No ARs cleared for customer ${customerId}`);
        return;
      }

      // Emit ar.payment.recorded for each cleared AR (triggers commission auto-approval)
      for (const record of result.clearedRecords) {
        this.eventEmitter.emit('ar.payment.recorded', {
          arId: record.arId,
          customerId,
          paymentAmount: record.paymentAmount,
          isFullyPaid: record.isFullyPaid,
          reference: `auto-clear:${triggerSource}`,
        });
      }

      // Emit summary event for notification
      this.eventEmitter.emit('ar.auto-clear.completed', {
        customerId,
        totalCleared: result.totalCleared,
        clearedCount: result.clearedRecords.length,
        walletBalanceAfter: result.walletBalanceAfter,
        triggerSource,
        clearedRecords: result.clearedRecords,
      });

      this.logger.log(
        `Auto-clear completed: ${result.clearedRecords.length} ARs, ` +
          `${result.totalCleared} VND cleared for customer ${customerId}`,
      );
    } catch (error) {
      // Do NOT re-throw: wallet credit already succeeded,
      // accountant can manually clear AR later
      this.logger.error(
        `Auto-clear AR failed for customer ${customerId} (trigger: ${triggerSource}): ${error.message}`,
        error.stack,
      );
    }
  }
}
