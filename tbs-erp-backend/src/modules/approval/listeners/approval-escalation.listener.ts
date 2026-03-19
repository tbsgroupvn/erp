import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalAction, ApprovalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Maps each UserRole to its escalation target in the business approval matrix.
 * When an approval step is overdue past the auto-escalation threshold,
 * the step is reassigned to the next role up in the hierarchy.
 */
export const ESCALATION_ROLE_MAP: Record<string, string> = {
  // Sales chain
  [UserRole.SALE]: UserRole.SALES_LEADER,
  [UserRole.SALES_LEADER]: UserRole.SALES_DIRECTOR,
  [UserRole.SALES_DIRECTOR]: UserRole.CEO,

  // Accounting chain
  [UserRole.ACCOUNTANT]: UserRole.CHIEF_ACCOUNTANT,
  [UserRole.ACCOUNTANT_AR]: UserRole.CHIEF_ACCOUNTANT,
  [UserRole.ACCOUNTANT_COST]: UserRole.CHIEF_ACCOUNTANT,
  [UserRole.CHIEF_ACCOUNTANT]: UserRole.CFO,
  [UserRole.CFO]: UserRole.CEO,

  // Warehouse VN chain
  [UserRole.WAREHOUSE_VN_STAFF]: UserRole.WAREHOUSE_VN_MANAGER,
  [UserRole.WAREHOUSE_VN_MANAGER]: UserRole.LOGISTICS_MANAGER,

  // Warehouse CN chain
  [UserRole.WAREHOUSE_CN_AGENT]: UserRole.WAREHOUSE_MANAGER,
  [UserRole.WAREHOUSE_MANAGER]: UserRole.LOGISTICS_MANAGER,

  // Logistics chain
  [UserRole.LOGISTICS_MANAGER]: UserRole.COO,

  // Import/Export chain
  [UserRole.XNK_STAFF]: UserRole.XNK_MANAGER,
  [UserRole.XNK_MANAGER]: UserRole.DIRECTOR_OPERATIONS,
  [UserRole.DIRECTOR_OPERATIONS]: UserRole.COO,

  // Operations
  [UserRole.COO]: UserRole.CEO,

  // Support roles
  [UserRole.CSKH]: UserRole.SALES_LEADER,
  [UserRole.MARKETING_STAFF]: UserRole.SALES_DIRECTOR,
  [UserRole.HR_MANAGER]: UserRole.COO,
  [UserRole.DRIVER]: UserRole.LOGISTICS_MANAGER,
};

export interface ApprovalEscalatedEvent {
  approvalId: string;
  type: string;
  referenceId: string;
  currentStep: number;
  currentStepRole?: string;
  pendingSince: Date;
}

@Injectable()
export class ApprovalEscalationListener {
  private readonly logger = new Logger(ApprovalEscalationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('approval.escalated')
  async handleEscalation(event: ApprovalEscalatedEvent): Promise<void> {
    const { approvalId, currentStep, currentStepRole } = event;

    if (!currentStepRole) {
      this.logger.warn(
        `Cannot escalate approval ${approvalId}: no currentStepRole provided`,
      );
      return;
    }

    // Look up escalation target
    const escalationTarget = ESCALATION_ROLE_MAP[currentStepRole];

    if (!escalationTarget) {
      this.logger.warn(
        `Cannot escalate approval ${approvalId}: role ${currentStepRole} has no escalation target (already at top or unknown role)`,
      );
      return;
    }

    try {
      // Find the current PENDING step
      const step = await this.prisma.approvalStep.findFirst({
        where: {
          approvalId,
          stepNumber: currentStep,
          status: ApprovalStatus.PENDING,
        },
      });

      if (!step) {
        this.logger.warn(
          `Cannot escalate approval ${approvalId}: no PENDING step found at step ${currentStep}`,
        );
        return;
      }

      // Reassign the step to the escalation target role
      await this.prisma.approvalStep.update({
        where: { id: step.id },
        data: {
          approverRole: escalationTarget as UserRole,
          isOverdue: true,
        },
      });

      // Log the escalation action (AUTO_ESCALATE is a valid ApprovalAction enum value)
      await this.prisma.approvalActionLog.create({
        data: {
          approvalId,
          userId: 'SYSTEM',
          action: ApprovalAction.AUTO_ESCALATE,
          comment: `Auto-escalated from ${currentStepRole} to ${escalationTarget} due to SLA breach`,
        },
      });

      // Notify the new approver role
      this.eventEmitter.emit('notification.send', {
        type: 'APPROVAL_ESCALATED',
        title: 'Phe duyet duoc chuyen cap',
        body: `Yeu cau phe duyet ${event.referenceId} da duoc chuyen cap tu ${currentStepRole} sang ${escalationTarget} do qua han xu ly.`,
        referenceId: approvalId,
        targetRole: escalationTarget,
        isUrgent: true,
      });

      this.logger.log(
        `Approval ${approvalId} escalated from ${currentStepRole} to ${escalationTarget}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to escalate approval ${approvalId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
