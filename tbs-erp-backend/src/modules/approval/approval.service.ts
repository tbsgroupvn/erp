import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalAction, ApprovalStatus, ApprovalType, UserRole } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { ApprovalGraphEngine } from './domain/approval-graph-engine';
import { ApprovalRepository } from './approval.repository';
import { FlowDefinitionRepository } from './flow-definition/flow-definition.repository';
import { DelegationService } from './delegation/delegation.service';
import { ApprovalQueryDto } from './dto/approval-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly graphEngine: ApprovalGraphEngine,
    private readonly approvalRepository: ApprovalRepository,
    private readonly flowDefRepo: FlowDefinitionRepository,
    private readonly delegationService: DelegationService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create an approval request using the graph engine.
   * Requires a flow definition to be configured for the given type.
   */
  async createApprovalRequest(
    type: ApprovalType,
    referenceId: string,
    requestedBy: string,
    options?: {
      referenceCode?: string;
      requestData?: Record<string, unknown>;
      isUrgent?: boolean;
    },
  ) {
    const flowDef = await this.flowDefRepo.findActiveByTriggerType(type);

    if (!flowDef) {
      throw new BadRequestException(
        `Chưa có quy trình phê duyệt cho loại "${type}". ` +
          `Vui lòng cài đặt template tại Cài đặt > Quy trình phê duyệt.`,
      );
    }

    this.logger.log(`Using graph engine for ${type} (flow: ${flowDef.name} v${flowDef.version})`);
    return this.graphEngine.initiateApproval(
      flowDef.id,
      referenceId,
      requestedBy,
      options?.requestData ?? {},
      {
        referenceCode: options?.referenceCode,
        isUrgent: options?.isUrgent,
      },
    );
  }

  /**
   * Process a step in the approval workflow (graph engine only).
   */
  async processStep(
    approvalId: string,
    decision: 'APPROVE' | 'REJECT',
    approverId: string,
    approverRole: UserRole,
    comment?: string,
  ) {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    const currentStep = approval.steps.find(
      (s) => s.stepNumber === approval.currentStep && s.status === ApprovalStatus.PENDING,
    );
    if (!currentStep) {
      throw new BadRequestException('No pending step found');
    }

    return this.graphEngine.processDecision(approvalId, currentStep.id, decision, approverId, {
      comment,
    });
  }

  /**
   * Batch approve multiple approvals at once.
   */
  async batchApprove(
    approvalIds: string[],
    approverId: string,
    approverRole: UserRole,
    comment?: string,
  ) {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const results: Array<{ approvalId: string; success: boolean; error?: string }> = [];

    for (const id of approvalIds) {
      try {
        const approval = await this.approvalRepository.findById(id);
        if (!approval) {
          results.push({ approvalId: id, success: false, error: 'Not found' });
          continue;
        }

        if (approval.status !== ApprovalStatus.PENDING) {
          results.push({ approvalId: id, success: false, error: `Already ${approval.status}` });
          continue;
        }

        const currentStep = approval.steps.find(
          (s) => s.stepNumber === approval.currentStep && s.status === ApprovalStatus.PENDING,
        );
        if (!currentStep) {
          results.push({ approvalId: id, success: false, error: 'No pending step' });
          continue;
        }

        // Tag with batchId
        await this.prisma.approval.update({
          where: { id },
          data: { batchId },
        });

        await this.graphEngine.processDecision(id, currentStep.id, 'APPROVE', approverId, {
          comment: comment ? `[Batch] ${comment}` : '[Batch approve]',
        });

        results.push({ approvalId: id, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ approvalId: id, success: false, error: message });
        this.logger.warn(`Batch approve failed for ${id}: ${message}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(`Batch approve: ${successCount}/${approvalIds.length} succeeded (batch=${batchId})`);

    return { batchId, results, successCount, failCount: approvalIds.length - successCount };
  }

  /**
   * Batch reject multiple approvals at once.
   */
  async batchReject(
    approvalIds: string[],
    approverId: string,
    approverRole: UserRole,
    comment?: string,
  ) {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const results: Array<{ approvalId: string; success: boolean; error?: string }> = [];

    for (const id of approvalIds) {
      try {
        const approval = await this.approvalRepository.findById(id);
        if (!approval) {
          results.push({ approvalId: id, success: false, error: 'Not found' });
          continue;
        }

        if (approval.status !== ApprovalStatus.PENDING) {
          results.push({ approvalId: id, success: false, error: `Already ${approval.status}` });
          continue;
        }

        const currentStep = approval.steps.find(
          (s) => s.stepNumber === approval.currentStep && s.status === ApprovalStatus.PENDING,
        );
        if (!currentStep) {
          results.push({ approvalId: id, success: false, error: 'No pending step' });
          continue;
        }

        await this.prisma.approval.update({
          where: { id },
          data: { batchId },
        });

        await this.graphEngine.processDecision(id, currentStep.id, 'REJECT', approverId, {
          comment: comment ? `[Batch] ${comment}` : '[Batch reject]',
        });

        results.push({ approvalId: id, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ approvalId: id, success: false, error: message });
        this.logger.warn(`Batch reject failed for ${id}: ${message}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(`Batch reject: ${successCount}/${approvalIds.length} succeeded (batch=${batchId})`);

    return { batchId, results, successCount, failCount: approvalIds.length - successCount };
  }

  /**
   * Delegate a step to another user.
   */
  async delegateStep(
    approvalId: string,
    stepId: string,
    fromUserId: string,
    toUserId: string,
    comment?: string,
  ) {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    const step = approval.steps.find((s) => s.id === stepId);
    if (!step || step.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Step not found or not pending');
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { role: true },
    });
    if (!toUser) {
      throw new NotFoundException('Target user not found');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          assignedUserId: toUserId,
          approverRole: toUser.role,
          delegatedFromUserId: fromUserId,
        },
      });

      await tx.approvalActionLog.create({
        data: {
          approvalId,
          userId: fromUserId,
          action: ApprovalAction.DELEGATE,
          delegateToUserId: toUserId,
          comment,
        },
      });

      return this.approvalRepository.findById(approvalId);
    });
  }

  /**
   * Add an extra approver step after a given step number.
   */
  async addApproverStep(
    approvalId: string,
    afterStepNumber: number,
    role: UserRole,
    addedBy: string,
    userId?: string,
  ) {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is not pending');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      const stepsToShift = approval.steps.filter((s) => s.stepNumber > afterStepNumber);
      for (const step of stepsToShift) {
        await tx.approvalStep.update({
          where: { id: step.id },
          data: { stepNumber: step.stepNumber + 1 },
        });
      }

      const newStep = await tx.approvalStep.create({
        data: {
          approvalId,
          stepNumber: afterStepNumber + 1,
          approverRole: role,
          assignedUserId: userId,
          status: ApprovalStatus.PENDING,
        },
      });

      await tx.approval.update({
        where: { id: approvalId },
        data: { totalSteps: approval.totalSteps + 1 },
      });

      await tx.approvalActionLog.create({
        data: {
          approvalId,
          userId: addedBy,
          action: ApprovalAction.ADD_APPROVER,
          addedStepId: newStep.id,
          comment: `Added ${role} after step ${afterStepNumber}`,
        },
      });

      return this.approvalRepository.findById(approvalId);
    });
  }

  /**
   * Withdraw an approval (by the requester).
   */
  async withdrawApproval(approvalId: string, userId: string) {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (approval.requestedBy !== userId) {
      throw new BadRequestException('Only the requester can withdraw');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending approvals can be withdrawn');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      await tx.approval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.WITHDRAWN },
      });

      await tx.approvalActionLog.create({
        data: {
          approvalId,
          userId,
          action: ApprovalAction.WITHDRAW,
        },
      });

      return this.approvalRepository.findById(approvalId);
    });
  }

  /**
   * Return an approval for revision.
   */
  async returnApproval(approvalId: string, userId: string, comment: string) {
    const approval = await this.approvalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending approvals can be returned');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      await tx.approval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.RETURNED },
      });

      await tx.approvalActionLog.create({
        data: {
          approvalId,
          userId,
          action: ApprovalAction.RETURN,
          comment,
        },
      });

      return this.approvalRepository.findById(approvalId);
    });
  }

  /**
   * Add a comment to an approval.
   */
  async addComment(approvalId: string, userId: string, content: string, stepId?: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
    });
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    const comment = await this.prisma.approvalComment.create({
      data: {
        approvalId,
        userId,
        content,
        stepId,
      },
    });

    await this.prisma.approvalActionLog.create({
      data: {
        approvalId,
        userId,
        action: ApprovalAction.COMMENT,
        comment: content,
      },
    });

    return comment;
  }

  /**
   * Get comments for an approval.
   */
  async getComments(approvalId: string) {
    return this.prisma.approvalComment.findMany({
      where: { approvalId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get action log for an approval.
   */
  async getActionLog(approvalId: string) {
    return this.prisma.approvalActionLog.findMany({
      where: { approvalId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get badge counts for a user.
   */
  async getApprovalCounts(userId: string, role: UserRole) {
    const [pendingForMe, mySubmitted, myProcessed, ccForMe] = await Promise.all([
      this.approvalRepository.countPendingForUser(userId, role),
      this.approvalRepository.countMySubmitted(userId),
      this.approvalRepository.countMyProcessed(userId),
      this.approvalRepository.countMyCCApprovals(userId),
    ]);

    return { pendingForMe, mySubmitted, myProcessed, ccForMe };
  }

  /**
   * Get pending approvals for a specific role (for "My Pending" view).
   */
  async getMyPendingApprovals(role: UserRole, limit = 20, offset = 0) {
    return this.approvalRepository.findPendingByRole(role, limit, offset);
  }

  /**
   * Get approvals submitted by a user.
   */
  async getMySubmitted(userId: string, query: ApprovalQueryDto) {
    return this.approvalRepository.findSubmittedByUser(userId, query);
  }

  /**
   * Get approvals processed by a user.
   */
  async getMyProcessed(userId: string, query: ApprovalQueryDto) {
    return this.approvalRepository.findProcessedByUser(userId, query);
  }

  /**
   * Get CC approvals for a user.
   */
  async getMyCCApprovals(userId: string, query: ApprovalQueryDto) {
    return this.approvalRepository.findCCByUser(userId, query);
  }

  /**
   * Get approval history for a user (as requester or approver).
   */
  async getHistory(userId: string, limit = 20, offset = 0) {
    return this.approvalRepository.findHistory(userId, limit, offset);
  }

  /**
   * List all approvals with pagination and filters.
   */
  async findAll(query: ApprovalQueryDto) {
    const { data, total } = await this.approvalRepository.findMany(query);
    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Get a single approval by ID.
   */
  async findById(id: string) {
    const approval = await this.approvalRepository.findById(id);
    if (!approval) {
      throw new NotFoundException(`Approval ${id} not found`);
    }
    return approval;
  }

  /**
   * Cron job: Check for overdue approval steps every hour.
   * Emits escalation events for overdue approvals.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueApprovals(): Promise<void> {
    const escalateAfterHours = this.configService.get<number>(
      'business.approval.escalateAfterHours',
      24,
    );

    const overdueThreshold = new Date(Date.now() - escalateAfterHours * 60 * 60 * 1000);

    const overdueApprovals = await this.prisma.approval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        updatedAt: { lt: overdueThreshold },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (overdueApprovals.length === 0) {
      return;
    }

    this.logger.warn(`Found ${overdueApprovals.length} overdue approval(s)`);

    for (const approval of overdueApprovals) {
      const currentStep = approval.steps.find((s) => s.stepNumber === approval.currentStep);

      // Mark step as overdue
      if (currentStep && !currentStep.isOverdue) {
        await this.prisma.approvalStep.update({
          where: { id: currentStep.id },
          data: { isOverdue: true },
        });
      }

      this.eventEmitter.emit('approval.overdue', {
        approvalId: approval.id,
        type: approval.type,
        referenceId: approval.referenceId,
        referenceCode: approval.referenceCode,
        currentStep: approval.currentStep,
        currentStepRole: currentStep?.approverRole,
        pendingSince: approval.updatedAt,
      });

      // Auto-escalate if pending for 2x the threshold
      const autoEscalateThreshold = new Date(
        Date.now() - escalateAfterHours * 2 * 60 * 60 * 1000,
      );
      if (approval.updatedAt < autoEscalateThreshold) {
        this.eventEmitter.emit('approval.escalated', {
          approvalId: approval.id,
          type: approval.type,
          referenceId: approval.referenceId,
          currentStep: approval.currentStep,
          currentStepRole: currentStep?.approverRole,
          pendingSince: approval.updatedAt,
        });

        this.logger.warn(
          `Auto-escalated approval ${approval.id} (type=${approval.type}) ` +
            `- pending since ${approval.updatedAt.toISOString()}`,
        );
      }
    }
  }
}
