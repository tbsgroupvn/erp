import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CrmRepository } from '../crm.repository';
import { CrmService } from '../crm.service';

export interface OrderCompletedEvent {
  orderId: string;
  customerId: string;
  totalAmount: number;
}

@Injectable()
export class OrderCompletedListener {
  private readonly logger = new Logger(OrderCompletedListener.name);

  constructor(
    private readonly crmRepository: CrmRepository,
    private readonly crmService: CrmService,
  ) {}

  /**
   * Listen for order.completed events.
   * Update the customer's totalOrders and totalRevenue, then re-evaluate tier.
   */
  @OnEvent('order.completed')
  async handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
    this.logger.log(
      `Order completed event received: orderId=${event.orderId}, customerId=${event.customerId}, amount=${event.totalAmount}`,
    );

    try {
      // Increment order stats
      await this.crmRepository.incrementOrderStats(
        event.customerId,
        event.totalAmount,
      );

      // Re-evaluate tier
      await this.crmService.updateTier(event.customerId);

      this.logger.log(
        `Customer ${event.customerId} stats updated after order ${event.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process order.completed for customer ${event.customerId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
