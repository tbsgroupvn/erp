import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { ApprovalStatus } from '@prisma/client';

/**
 * Tracks SLA deadlines for approval steps and handles overdue/escalation.
 */
@Injectable()
export class SlaTracker {
  private readonly logger = new Logger(SlaTracker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check for overdue approval steps every 30 minutes.
   * Marks steps as overdue and emits events.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkOverdueSteps(): Promise<void> {
    const now = new Date();

    // Find steps with deadlines that have passed
    const overdueSteps = await this.prisma.approvalStep.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        deadlineAt: { lt: now },
        isOverdue: false,
      },
      include: {
        approval: { select: { id: true, type: true, referenceId: true, referenceCode: true } },
      },
    });

    if (overdueSteps.length === 0) return;

    this.logger.warn(`Found ${overdueSteps.length} overdue approval step(s)`);

    for (const step of overdueSteps) {
      // Mark as overdue
      await this.prisma.approvalStep.update({
        where: { id: step.id },
        data: { isOverdue: true },
      });

      // Emit overdue event
      this.eventEmitter.emit('approval.step.overdue', {
        approvalId: step.approvalId,
        stepId: step.id,
        stepNumber: step.stepNumber,
        approverRole: step.approverRole,
        assignedUserId: step.assignedUserId,
        deadlineAt: step.deadlineAt,
        type: step.approval.type,
        referenceId: step.approval.referenceId,
        referenceCode: step.approval.referenceCode,
      });

      this.logger.warn(
        `Step ${step.id} (approval=${step.approvalId}) is overdue. ` +
          `Deadline was ${step.deadlineAt?.toISOString()}`,
      );
    }
  }

  /**
   * Calculate deadline for a step based on deadlineHours from node config.
   */
  calculateDeadline(deadlineHours: number | null | undefined): Date | null {
    if (!deadlineHours || deadlineHours <= 0) return null;
    return new Date(Date.now() + deadlineHours * 60 * 60 * 1000);
  }
}
