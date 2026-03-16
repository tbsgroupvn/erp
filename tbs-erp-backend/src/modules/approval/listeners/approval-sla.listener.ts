import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ApprovalStepOverdueEvent {
  approvalId: string;
  stepId: string;
  stepNumber: number;
  approverRole: string;
  assignedUserId?: string;
  deadlineAt: Date;
  type: string;
  referenceId: string;
  referenceCode?: string;
}

@Injectable()
export class ApprovalSlaListener {
  private readonly logger = new Logger(ApprovalSlaListener.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('approval.step.overdue')
  async handleStepOverdue(event: ApprovalStepOverdueEvent): Promise<void> {
    this.logger.warn(
      `SLA breach: approval=${event.approvalId}, step=${event.stepNumber}, ` +
        `role=${event.approverRole}, deadline=${event.deadlineAt.toISOString()}`,
    );

    try {
      // Emit notification event for the overdue step
      this.eventEmitter.emit('notification.send', {
        type: 'APPROVAL_OVERDUE',
        title: 'Phe duyet qua han',
        body: `Yeu cau phe duyet ${event.referenceCode || event.referenceId} da qua han xu ly.`,
        referenceId: event.approvalId,
        targetRole: event.approverRole,
        targetUserId: event.assignedUserId,
        isUrgent: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process approval.step.overdue for approval ${event.approvalId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
