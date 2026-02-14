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

    // Emit notification event for the overdue step
    this.eventEmitter.emit('notification.send', {
      type: 'APPROVAL_OVERDUE',
      title: 'Phê duyệt quá hạn',
      body: `Yêu cầu phê duyệt ${event.referenceCode || event.referenceId} đã quá hạn xử lý.`,
      referenceId: event.approvalId,
      targetRole: event.approverRole,
      targetUserId: event.assignedUserId,
      isUrgent: true,
    });
  }
}
