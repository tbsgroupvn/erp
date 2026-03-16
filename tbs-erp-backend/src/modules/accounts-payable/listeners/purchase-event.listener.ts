import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountsPayableService } from '../accounts-payable.service';

export interface PurchaseCreatedEvent {
  purchaseId: string;
  vendorId?: string;
  vendorName?: string;
  amount: number;
  dueDate?: string;
  createdBy: string;
}

@Injectable()
export class PurchaseEventListener {
  private readonly logger = new Logger(PurchaseEventListener.name);

  constructor(private readonly apService: AccountsPayableService) {}

  /**
   * When a purchase order is confirmed, create an AP record.
   */
  @OnEvent('purchase.confirmed')
  async handlePurchaseConfirmed(event: PurchaseCreatedEvent): Promise<void> {
    const vendorLabel = event.vendorName ?? event.vendorId ?? 'unknown';
    this.logger.log(
      `Purchase confirmed event: purchaseId=${event.purchaseId}, vendor=${vendorLabel}, amount=${event.amount}`,
    );

    try {
      const dueDate =
        event.dueDate ?? new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();

      await this.apService.createPayable(
        {
          vendorId: event.vendorId,
          vendorName: event.vendorName,
          amount: event.amount,
          dueDate,
        },
        event.createdBy,
      );

      this.logger.log(`AP created for purchase ${event.purchaseId}, vendor=${vendorLabel}`);
    } catch (error) {
      this.logger.error(
        `Failed to create AP for purchase ${event.purchaseId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
