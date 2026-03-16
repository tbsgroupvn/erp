import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExtraChargeService } from '../domain/extra-charge.service';

export interface ExtraChargeApprovalCompletedEvent {
  chargeId: string;
  status: 'APPROVED' | 'REJECTED';
  approverId: string;
}

@Injectable()
export class ExtraChargeApprovalListener {
  private readonly logger = new Logger(ExtraChargeApprovalListener.name);

  constructor(private readonly extraChargeService: ExtraChargeService) {}

  @OnEvent('extra_charge.approval.completed')
  async handleExtraChargeApprovalCompleted(
    event: ExtraChargeApprovalCompletedEvent,
  ): Promise<void> {
    this.logger.log(
      `Extra charge approval completed: chargeId=${event.chargeId}, status=${event.status}`,
    );

    try {
      if (event.status === 'APPROVED') {
        await this.extraChargeService.approveExtraCharge(
          event.chargeId,
          event.approverId,
        );
        this.logger.log(`Extra charge ${event.chargeId} approved via approval flow`);
      } else if (event.status === 'REJECTED') {
        await this.extraChargeService.rejectExtraCharge(
          event.chargeId,
          event.approverId,
        );
        this.logger.log(`Extra charge ${event.chargeId} rejected via approval flow`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process extra charge approval for ${event.chargeId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
