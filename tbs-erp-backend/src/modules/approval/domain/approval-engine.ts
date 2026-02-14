import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import {
  Approval,
  ApprovalStatus,
  ApprovalStep,
  ApprovalType,
  UserRole,
} from '@prisma/client';

export interface ApprovalFlowStep {
  stepNumber: number;
  approverRole: UserRole;
}

export interface ApprovalFlowDefinition {
  type: ApprovalType;
  steps: ApprovalFlowStep[];
}

export type ApprovalWithSteps = Approval & { steps: ApprovalStep[] };

/**
 * Generic approval engine that supports multi-step approval workflows.
 *
 * Approval flow:
 * 1. defineFlow() registers the steps for each approval type
 * 2. submitForApproval() creates an Approval record with ApprovalStep records
 * 3. processDecision() processes APPROVE/REJECT at the current step
 *    - APPROVE: marks step done, advances to next or completes
 *    - REJECT: marks entire approval as rejected
 */
@Injectable()
export class ApprovalEngine {
  private readonly logger = new Logger(ApprovalEngine.name);

  /**
   * In-memory registry of approval flows.
   * Flows are registered at module startup via registerFlow().
   */
  private readonly flowRegistry = new Map<
    ApprovalType,
    ApprovalFlowStep[]
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register an approval flow definition. Called by flow definition files.
   */
  defineFlow(type: ApprovalType, steps: ApprovalFlowStep[]): void {
    this.flowRegistry.set(type, steps);
    this.logger.log(
      `Approval flow registered: ${type} with ${steps.length} step(s)`,
    );
  }

  /**
   * Get the flow definition for a given type.
   */
  getFlowSteps(type: ApprovalType): ApprovalFlowStep[] {
    const steps = this.flowRegistry.get(type);
    if (!steps) {
      throw new BadRequestException(
        `No approval flow defined for type: ${type}`,
      );
    }
    return steps;
  }

  /**
   * Submit a new request for approval.
   * Creates the Approval record and all its ApprovalStep records.
   */
  async submitForApproval(
    type: ApprovalType,
    referenceId: string,
    requestedBy: string,
    options?: {
      referenceCode?: string;
      requestData?: Record<string, unknown>;
      overrideSteps?: ApprovalFlowStep[];
    },
  ): Promise<ApprovalWithSteps> {
    const steps = options?.overrideSteps ?? this.getFlowSteps(type);

    if (steps.length === 0) {
      throw new BadRequestException(
        `Approval flow for ${type} has no steps defined`,
      );
    }

    const approval = await this.prisma.executeInTransaction(async (tx) => {
      // Create the approval record
      const approval = await tx.approval.create({
        data: {
          type,
          referenceId,
          referenceCode: options?.referenceCode,
          requestedBy,
          requestData: (options?.requestData as any) ?? undefined,
          status: ApprovalStatus.PENDING,
          currentStep: 1,
          totalSteps: steps.length,
        },
      });

      // Create all step records
      for (const step of steps) {
        await tx.approvalStep.create({
          data: {
            approvalId: approval.id,
            stepNumber: step.stepNumber,
            approverRole: step.approverRole,
            status: ApprovalStatus.PENDING,
          },
        });
      }

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    });

    if (!approval) {
      throw new InternalServerErrorException('Failed to create approval record');
    }

    this.eventEmitter.emit('approval.submitted', {
      approvalId: approval.id,
      type,
      referenceId,
      requestedBy,
      currentStepRole: steps[0].approverRole,
    });

    this.logger.log(
      `Approval submitted: type=${type}, ref=${referenceId}, steps=${steps.length}`,
    );

    return approval as ApprovalWithSteps;
  }

  /**
   * Process a decision (APPROVE or REJECT) for a given approval at its current step.
   */
  async processDecision(
    approvalId: string,
    decision: 'APPROVE' | 'REJECT',
    approverId: string,
    approverRole: UserRole,
    comment?: string,
  ): Promise<ApprovalWithSteps> {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Approval ${approvalId} is already ${approval.status}`,
      );
    }

    // Find the current pending step
    const currentStep = approval.steps.find(
      (s) => s.stepNumber === approval.currentStep,
    );

    if (!currentStep) {
      throw new BadRequestException(
        `No step found at position ${approval.currentStep}`,
      );
    }

    if (currentStep.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Step ${currentStep.stepNumber} is already ${currentStep.status}`,
      );
    }

    // Verify the approver has the required role
    if (currentStep.approverRole !== approverRole) {
      throw new BadRequestException(
        `Role ${approverRole} cannot approve step ${currentStep.stepNumber}. ` +
          `Required role: ${currentStep.approverRole}`,
      );
    }

    if (decision === 'REJECT') {
      return this.handleReject(approval, currentStep, approverId, comment);
    }

    return this.handleApprove(approval, currentStep, approverId, comment);
  }

  /**
   * Handle an APPROVE decision: advance to next step or complete.
   */
  private async handleApprove(
    approval: ApprovalWithSteps,
    currentStep: ApprovalStep,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalWithSteps> {
    const isLastStep = approval.currentStep >= approval.totalSteps;

    return this.prisma.executeInTransaction(async (tx) => {
      // Mark current step as approved
      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status: ApprovalStatus.APPROVED,
          approverId,
          comment,
          decidedAt: new Date(),
        },
      });

      if (isLastStep) {
        // All steps approved - mark approval as completed
        await tx.approval.update({
          where: { id: approval.id },
          data: { status: ApprovalStatus.APPROVED },
        });

        this.eventEmitter.emit('approval.completed', {
          approvalId: approval.id,
          type: approval.type,
          referenceId: approval.referenceId,
          status: 'APPROVED',
          approverId,
        });

        this.logger.log(
          `Approval completed (APPROVED): ${approval.id}, type=${approval.type}`,
        );
      } else {
        // Advance to next step
        const nextStepNumber = approval.currentStep + 1;
        await tx.approval.update({
          where: { id: approval.id },
          data: { currentStep: nextStepNumber },
        });

        const nextStep = approval.steps.find(
          (s) => s.stepNumber === nextStepNumber,
        );

        this.eventEmitter.emit('approval.step.completed', {
          approvalId: approval.id,
          type: approval.type,
          referenceId: approval.referenceId,
          completedStep: approval.currentStep,
          nextStep: nextStepNumber,
          nextStepRole: nextStep?.approverRole,
        });

        this.logger.log(
          `Approval step ${approval.currentStep} approved, advancing to step ${nextStepNumber}`,
        );
      }

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      }) as Promise<ApprovalWithSteps>;
    });
  }

  /**
   * Handle a REJECT decision: reject the entire approval.
   */
  private async handleReject(
    approval: ApprovalWithSteps,
    currentStep: ApprovalStep,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalWithSteps> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Mark current step as rejected
      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status: ApprovalStatus.REJECTED,
          approverId,
          comment,
          decidedAt: new Date(),
        },
      });

      // Mark the entire approval as rejected
      await tx.approval.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.REJECTED },
      });

      this.eventEmitter.emit('approval.completed', {
        approvalId: approval.id,
        type: approval.type,
        referenceId: approval.referenceId,
        status: 'REJECTED',
        approverId,
        comment,
      });

      this.logger.log(
        `Approval REJECTED: ${approval.id}, type=${approval.type}, step=${currentStep.stepNumber}`,
      );

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      }) as Promise<ApprovalWithSteps>;
    });
  }

  /**
   * Escalate overdue approvals. Checks for approvals pending longer than
   * a specified threshold and emits escalation events.
   */
  async escalateOverdue(thresholdHours = 24): Promise<number> {
    const threshold = new Date(
      Date.now() - thresholdHours * 60 * 60 * 1000,
    );

    const overdueApprovals = await this.prisma.approval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        updatedAt: { lt: threshold },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    for (const approval of overdueApprovals) {
      const currentStep = approval.steps.find(
        (s) => s.stepNumber === approval.currentStep,
      );

      this.eventEmitter.emit('approval.escalated', {
        approvalId: approval.id,
        type: approval.type,
        referenceId: approval.referenceId,
        currentStep: approval.currentStep,
        currentStepRole: currentStep?.approverRole,
        pendingSince: approval.updatedAt,
      });
    }

    if (overdueApprovals.length > 0) {
      this.logger.warn(
        `Escalated ${overdueApprovals.length} overdue approval(s)`,
      );
    }

    return overdueApprovals.length;
  }
}
