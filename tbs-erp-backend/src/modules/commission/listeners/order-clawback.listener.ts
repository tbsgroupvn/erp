import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommissionService } from '../commission.service';

export interface OrderCommissionClawbackEvent {
  orderId: string;
  reason: string;
  triggeredBy: string;
}

@Injectable()
export class OrderClawbackListener {
  private readonly logger = new Logger(OrderClawbackListener.name);

  constructor(private readonly commissionService: CommissionService) {}

  @OnEvent('order.commission.clawback')
  async handleCommissionClawback(event: OrderCommissionClawbackEvent): Promise<void> {
    this.logger.log(
      `Commission clawback triggered for order ${event.orderId}: ${event.reason}`,
    );

    try {
      const result = await this.commissionService.clawbackCommission(
        event.orderId,
        null,
        event.reason,
      );

      if (result) {
        this.logger.log(
          `Commission clawback result for order ${event.orderId}: ${result.action}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to clawback commission for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
