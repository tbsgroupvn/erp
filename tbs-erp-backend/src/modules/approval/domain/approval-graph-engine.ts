import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import {
  Approval,
  ApprovalAction,
  ApprovalMode,
  ApprovalNodeType,
  ApprovalStatus,
  ApprovalStep,
  ApproverType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { ConditionEvaluator } from './condition-evaluator';
import { ApproverResolver } from './approver-resolver';
import { SlaTracker } from './sla-tracker';

type FlowDefWithGraph = Prisma.ApprovalFlowDefinitionGetPayload<{
  include: {
    nodes: { include: { outgoingEdges: true } };
    edges: true;
  };
}>;

type FlowNode = FlowDefWithGraph['nodes'][number];
type FlowEdge = FlowDefWithGraph['edges'][number];
type ApprovalWithSteps = Approval & { steps: ApprovalStep[] };

/**
 * Graph-based approval engine that traverses flow definitions
 * supporting CONDITION routing, parallel approval (AND/OR), and CC nodes.
 */
@Injectable()
export class ApprovalGraphEngine {
  private readonly logger = new Logger(ApprovalGraphEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly approverResolver: ApproverResolver,
    private readonly slaTracker: SlaTracker,
  ) {}

  /**
   * Load a flow definition with all nodes and edges.
   */
  async loadFlowDefinition(flowDefId: string): Promise<FlowDefWithGraph> {
    const flowDef = await this.prisma.approvalFlowDefinition.findUnique({
      where: { id: flowDefId },
      include: {
        nodes: { include: { outgoingEdges: true } },
        edges: true,
      },
    });

    if (!flowDef) {
      throw new NotFoundException(
        `Flow definition ${flowDefId} not found`,
      );
    }

    return flowDef;
  }

  /**
   * Initiate a new approval using a flow definition.
   * Traverses the graph from START node to create initial steps.
   */
  async initiateApproval(
    flowDefId: string,
    referenceId: string,
    requestedBy: string,
    requestData: Record<string, unknown>,
    options?: {
      referenceCode?: string;
      isUrgent?: boolean;
    },
  ) {
    const flowDef = await this.loadFlowDefinition(flowDefId);

    const startNode = flowDef.nodes.find(
      (n) => n.nodeType === ApprovalNodeType.START,
    );

    if (!startNode) {
      throw new BadRequestException(
        `Flow definition ${flowDefId} has no START node`,
      );
    }

    // Traverse graph to find all approver steps needed
    const { steps, ccUsers } = await this.traverseFromNode(
      flowDef,
      startNode,
      requestData,
      requestedBy,
    );

    if (steps.length === 0) {
      throw new BadRequestException(
        'Flow definition produces no approval steps',
      );
    }

    const approval = await this.prisma.executeInTransaction(async (tx) => {
      // Create the approval record
      const approval = await tx.approval.create({
        data: {
          type: flowDef.triggerType as any,
          referenceId,
          referenceCode: options?.referenceCode,
          requestedBy,
          requestData: requestData as any,
          status: ApprovalStatus.PENDING,
          currentStep: 1,
          totalSteps: steps.length,
          flowDefinitionId: flowDefId,
          currentNodeKey: steps[0].nodeKey,
          isUrgent: options?.isUrgent ?? false,
          deadline: steps[0].deadlineAt,
        },
      });

      // Create all step records
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await tx.approvalStep.create({
          data: {
            approvalId: approval.id,
            stepNumber: i + 1,
            approverRole: step.role as UserRole,
            assignedUserId: step.userId,
            status: ApprovalStatus.PENDING,
            nodeId: step.nodeId,
            approvalMode: step.approvalMode,
            groupKey: step.groupKey,
            deadlineAt: step.deadlineAt,
          },
        });
      }

      // Create CC records
      for (const cc of ccUsers) {
        await tx.approvalCC.create({
          data: {
            approvalId: approval.id,
            userId: cc.userId,
            nodeId: cc.nodeId,
          },
        });
      }

      // Create action log for submission
      await tx.approvalActionLog.create({
        data: {
          approvalId: approval.id,
          userId: requestedBy,
          action: ApprovalAction.SUBMIT,
          dataSnapshot: requestData as any,
        },
      });

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: {
          steps: { orderBy: { stepNumber: 'asc' } },
          ccUsers: true,
        },
      });
    });

    if (!approval) {
      throw new Error('Failed to create approval record');
    }

    this.eventEmitter.emit('approval.submitted', {
      approvalId: approval.id,
      type: flowDef.triggerType,
      referenceId,
      requestedBy,
      currentStepRole: steps[0].role,
      isGraphBased: true,
    });

    this.logger.log(
      `Graph approval submitted: flowDef=${flowDefId}, ref=${referenceId}, steps=${steps.length}`,
    );

    return approval;
  }

  /**
   * Process a decision for a graph-based approval.
   */
  async processDecision(
    approvalId: string,
    stepId: string,
    decision: 'APPROVE' | 'REJECT',
    userId: string,
    options?: { comment?: string },
  ) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        flowDefinition: {
          include: {
            nodes: { include: { outgoingEdges: true } },
            edges: true,
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Approval ${approvalId} is already ${approval.status}`,
      );
    }

    const step = approval.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    if (step.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Step is already ${step.status}`,
      );
    }

    // Create action log
    await this.prisma.approvalActionLog.create({
      data: {
        approvalId,
        userId,
        action:
          decision === 'APPROVE'
            ? ApprovalAction.APPROVE
            : ApprovalAction.REJECT,
        comment: options?.comment,
        dataSnapshot: approval.requestData as any,
      },
    });

    if (decision === 'REJECT') {
      return this.handleGraphReject(approval, step, userId, options?.comment);
    }

    return this.handleGraphApprove(approval, step, userId, options?.comment);
  }

  /**
   * Handle approve for a graph-based step.
   * Checks parallel group completion and advances to next nodes.
   */
  private async handleGraphApprove(
    approval: ApprovalWithSteps,
    step: ApprovalStep,
    userId: string,
    comment?: string,
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      // Mark step as approved
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: ApprovalStatus.APPROVED,
          approverId: userId,
          comment,
          decidedAt: new Date(),
        },
      });

      // Check if this is part of a parallel group
      if (step.groupKey && step.approvalMode) {
        const groupSteps = approval.steps.filter(
          (s: ApprovalStep) => s.groupKey === step.groupKey,
        );

        const approvedInGroup = groupSteps.filter(
          (s: ApprovalStep) =>
            s.status === ApprovalStatus.APPROVED || s.id === step.id,
        ).length;

        if (step.approvalMode === ApprovalMode.PARALLEL_AND) {
          // All must approve
          if (approvedInGroup < groupSteps.length) {
            // Not all approved yet, wait
            return tx.approval.findUnique({
              where: { id: approval.id },
              include: { steps: { orderBy: { stepNumber: 'asc' } } },
            });
          }
        }
        // PARALLEL_OR: one is enough, continue
        // PARALLEL_AND: all approved, continue

        if (step.approvalMode === ApprovalMode.PARALLEL_OR) {
          // Cancel remaining pending steps in the group
          for (const gs of groupSteps) {
            if (gs.id !== step.id && gs.status === ApprovalStatus.PENDING) {
              await tx.approvalStep.update({
                where: { id: gs.id },
                data: { status: ApprovalStatus.CANCELLED },
              });
            }
          }
        }
      }

      // Check if this is the last step
      const allSteps = await tx.approvalStep.findMany({
        where: { approvalId: approval.id },
        orderBy: { stepNumber: 'asc' },
      });

      const pendingSteps = allSteps.filter(
        (s) => s.status === ApprovalStatus.PENDING,
      );

      if (pendingSteps.length === 0) {
        // All steps done — mark approval as APPROVED
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.APPROVED,
            currentNodeKey: 'end',
          },
        });

        this.eventEmitter.emit('approval.completed', {
          approvalId: approval.id,
          type: approval.type,
          referenceId: approval.referenceId,
          status: 'APPROVED',
          approverId: userId,
        });

        this.logger.log(
          `Graph approval completed (APPROVED): ${approval.id}`,
        );
      } else {
        // Advance currentStep to the next pending step
        const nextStep = pendingSteps[0];
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            currentStep: nextStep.stepNumber,
            currentNodeKey: nextStep.nodeId,
          },
        });

        this.eventEmitter.emit('approval.step.completed', {
          approvalId: approval.id,
          type: approval.type,
          referenceId: approval.referenceId,
          completedStep: step.stepNumber,
          nextStep: nextStep.stepNumber,
          nextStepRole: nextStep.approverRole,
        });
      }

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    });
  }

  /**
   * Handle reject for a graph-based step.
   */
  private async handleGraphReject(
    approval: ApprovalWithSteps,
    step: ApprovalStep,
    userId: string,
    comment?: string,
  ) {
    return this.prisma.executeInTransaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: ApprovalStatus.REJECTED,
          approverId: userId,
          comment,
          decidedAt: new Date(),
        },
      });

      await tx.approval.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.REJECTED },
      });

      this.eventEmitter.emit('approval.completed', {
        approvalId: approval.id,
        type: approval.type,
        referenceId: approval.referenceId,
        status: 'REJECTED',
        approverId: userId,
        comment,
      });

      this.logger.log(
        `Graph approval REJECTED: ${approval.id}, step=${step.stepNumber}`,
      );

      return tx.approval.findUnique({
        where: { id: approval.id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    });
  }

  /**
   * Traverse the flow graph from a given node to collect all steps and CC users.
   * Recursively follows edges, evaluating conditions at CONDITION nodes.
   */
  private async traverseFromNode(
    flowDef: FlowDefWithGraph,
    currentNode: FlowNode,
    requestData: Record<string, unknown>,
    requestedBy: string,
    visited = new Set<string>(),
  ): Promise<{
    steps: Array<{
      nodeKey: string;
      nodeId: string;
      role: string;
      userId?: string;
      approvalMode?: ApprovalMode | null;
      groupKey?: string;
      deadlineAt?: Date | null;
    }>;
    ccUsers: Array<{ userId: string; nodeId: string }>;
  }> {
    if (visited.has(currentNode.id)) {
      return { steps: [], ccUsers: [] };
    }
    visited.add(currentNode.id);

    const steps: Array<{
      nodeKey: string;
      nodeId: string;
      role: string;
      userId?: string;
      approvalMode?: ApprovalMode | null;
      groupKey?: string;
      deadlineAt?: Date | null;
    }> = [];
    const ccUsers: Array<{ userId: string; nodeId: string }> = [];

    switch (currentNode.nodeType) {
      case ApprovalNodeType.START:
      case ApprovalNodeType.END:
        // Just follow edges (START) or stop (END)
        if (currentNode.nodeType === ApprovalNodeType.END) {
          return { steps, ccUsers };
        }
        break;

      case ApprovalNodeType.APPROVER: {
        const resolvedApprovers = await this.approverResolver.resolve(
          currentNode.approverType ?? ApproverType.ROLE,
          requestedBy,
          {
            role: currentNode.approverRole ?? undefined,
            userId: currentNode.approverUserId ?? undefined,
          },
        );

        const groupKey =
          currentNode.approvalMode &&
          currentNode.approvalMode !== ApprovalMode.SEQUENTIAL
            ? `group_${currentNode.nodeKey}`
            : undefined;

        for (const approver of resolvedApprovers) {
          steps.push({
            nodeKey: currentNode.nodeKey,
            nodeId: currentNode.id,
            role: approver.role,
            userId: approver.userId,
            approvalMode: currentNode.approvalMode,
            groupKey,
            deadlineAt: this.slaTracker.calculateDeadline(
              currentNode.deadlineHours,
            ),
          });
        }
        break;
      }

      case ApprovalNodeType.CC: {
        // CC nodes: resolve users and add to CC list, then continue
        if (currentNode.approverUserId) {
          ccUsers.push({
            userId: currentNode.approverUserId,
            nodeId: currentNode.id,
          });
        }
        break;
      }

      case ApprovalNodeType.CONDITION: {
        // Evaluate condition and follow matching edge
        const outgoingEdges = flowDef.edges
          .filter((e) => e.sourceNodeId === currentNode.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        for (const edge of outgoingEdges) {
          const matches = edge.conditionExpression
            ? this.conditionEvaluator.evaluateExpression(
                edge.conditionExpression,
                requestData,
              )
            : true; // Default edge (no condition)

          if (matches) {
            const targetNode = flowDef.nodes.find(
              (n) => n.id === edge.targetNodeId,
            );
            if (targetNode) {
              const result = await this.traverseFromNode(
                flowDef,
                targetNode,
                requestData,
                requestedBy,
                visited,
              );
              steps.push(...result.steps);
              ccUsers.push(...result.ccUsers);
            }
            break; // Take first matching edge only
          }
        }

        return { steps, ccUsers }; // Already followed edges, don't follow again below
      }
    }

    // Follow outgoing edges (for non-CONDITION nodes)
    const outgoingEdges = flowDef.edges
      .filter((e) => e.sourceNodeId === currentNode.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    for (const edge of outgoingEdges) {
      const targetNode = flowDef.nodes.find(
        (n) => n.id === edge.targetNodeId,
      );
      if (targetNode) {
        const result = await this.traverseFromNode(
          flowDef,
          targetNode,
          requestData,
          requestedBy,
          visited,
        );
        steps.push(...result.steps);
        ccUsers.push(...result.ccUsers);
      }
    }

    return { steps, ccUsers };
  }

  /**
   * Test a flow definition with sample data without creating any records.
   * Returns the steps that would be created.
   */
  async testFlow(
    flowDefId: string,
    requestData: Record<string, unknown>,
    requestedBy: string,
  ) {
    const flowDef = await this.loadFlowDefinition(flowDefId);
    const startNode = flowDef.nodes.find(
      (n) => n.nodeType === ApprovalNodeType.START,
    );

    if (!startNode) {
      throw new BadRequestException('Flow has no START node');
    }

    const { steps, ccUsers } = await this.traverseFromNode(
      flowDef,
      startNode,
      requestData,
      requestedBy,
    );

    return {
      flowName: flowDef.name,
      totalSteps: steps.length,
      steps: steps.map((s, i) => ({
        stepNumber: i + 1,
        nodeKey: s.nodeKey,
        role: s.role,
        userId: s.userId,
        approvalMode: s.approvalMode,
        groupKey: s.groupKey,
        hasDeadline: !!s.deadlineAt,
      })),
      ccUsers,
    };
  }
}
