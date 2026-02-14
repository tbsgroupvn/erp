import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CashService } from '../cash.service';

export interface ApprovalCompletedEvent {
  approvalId: string;
  type: string;
  referenceId: string;
  status: string;
  approverId: string;
}

@Injectable()
export class ApprovalEventListener {
  private readonly logger = new Logger(ApprovalEventListener.name);

  constructor(private readonly cashService: CashService) {}

  /**
   * When a payment voucher approval is completed, auto-approve or reject the voucher.
   */
  @OnEvent('approval.completed')
  async handleApprovalCompleted(event: ApprovalCompletedEvent): Promise<void> {
    // Only handle voucher-related approvals
    if (
      event.type !== 'PAYMENT_VOUCHER' &&
      event.type !== 'RECEIPT_VOUCHER'
    ) {
      return;
    }

    this.logger.log(
      `Approval completed for voucher: referenceId=${event.referenceId}, status=${event.status}`,
    );

    try {
      if (event.status === 'APPROVED') {
        await this.cashService.approveVoucher(
          event.referenceId,
          event.approverId,
        );
      } else if (event.status === 'REJECTED') {
        await this.cashService.rejectVoucher(
          event.referenceId,
          event.approverId,
          'Rejected via approval workflow',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process approval for voucher ${event.referenceId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
