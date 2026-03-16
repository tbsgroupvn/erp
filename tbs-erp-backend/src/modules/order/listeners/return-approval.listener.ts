import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReturnRequestService } from '../domain/return-request.service';

export interface ReturnApprovalCompletedEvent {
  returnRequestId: string;
  status: 'APPROVED' | 'REJECTED';
  approverId: string;
}

@Injectable()
export class ReturnApprovalListener {
  private readonly logger = new Logger(ReturnApprovalListener.name);

  constructor(private readonly returnRequestService: ReturnRequestService) {}

  @OnEvent('order.return.approval.completed')
  async handleReturnApprovalCompleted(
    event: ReturnApprovalCompletedEvent,
  ): Promise<void> {
    this.logger.log(
      `Return approval completed: requestId=${event.returnRequestId}, status=${event.status}`,
    );

    try {
      if (event.status === 'APPROVED') {
        await this.returnRequestService.executeReturnRequest(
          event.returnRequestId,
          event.approverId,
        );
      } else {
        await this.returnRequestService.rejectReturnRequest(
          event.returnRequestId,
          event.approverId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle return approval for ${event.returnRequestId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
