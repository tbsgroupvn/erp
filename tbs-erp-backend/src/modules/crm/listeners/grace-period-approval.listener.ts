import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GracePeriodService } from '../domain/grace-period.service';

export interface ApprovalApprovedEvent {
  approvalId: string;
  type: string;
  requestData: {
    customerId: string;
    requestedDays: number;
    customerName?: string;
  };
}

@Injectable()
export class GracePeriodApprovalListener {
  private readonly logger = new Logger(GracePeriodApprovalListener.name);

  constructor(
    private readonly gracePeriodService: GracePeriodService,
  ) {}

  /**
   * Listen for approval.approved events where type is GRACE_PERIOD_REQUEST.
   * Calls onGracePeriodApproved() to grant the grace period to the customer.
   */
  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalApprovedEvent): Promise<void> {
    if (event.type !== 'GRACE_PERIOD_REQUEST') {
      return;
    }

    this.logger.log(
      `Grace period approval received: approvalId=${event.approvalId}, customerId=${event.requestData.customerId}`,
    );

    try {
      await this.gracePeriodService.onGracePeriodApproved(
        event.requestData.customerId,
        event.requestData.requestedDays,
      );

      this.logger.log(
        `Grace period granted for customer ${event.requestData.customerId} (${event.requestData.requestedDays} days)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process grace period approval for customer ${event.requestData.customerId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
