import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AssignmentStatus, OrderStatus, UserRole } from '@prisma/client';
import { StageConfigService } from './stage-config.service';

/** Stages where the order's sale owner is auto-assigned. */
const SALE_OWNED_STAGES = new Set<OrderStatus>([
  OrderStatus.CONSULTING,
  OrderStatus.QUOTATION,
  OrderStatus.SOURCING,
]);

export interface AssignmentResult {
  assignmentId: string;
  orderId: string;
  stage: OrderStatus;
  departmentCode: string;
  assigneeId: string | null;
  assigneeRole: UserRole;
  slaDeadline: Date | null;
}

/**
 * AssignmentEngineService manages who is responsible for an order at each lifecycle stage.
 *
 * On each stage transition it:
 * 1. Marks the previous stage assignment COMPLETED
 * 2. Creates a new ACTIVE assignment for the new stage
 * 3. Sets an SLA deadline based on the stage config
 */
@Injectable()
export class AssignmentEngineService {
  private readonly logger = new Logger(AssignmentEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stageConfigService: StageConfigService,
  ) {}

  /**
   * Handles a stage transition by completing the old assignment and creating the new one.
   * Both operations run inside a single DB transaction for data consistency.
   *
   * Returns the new assignment record, or null if no stage config exists for the new stage.
   */
  async handleStageTransition(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    changedBy: string,
  ): Promise<AssignmentResult | null> {
    // Get stage config first (cached, no need to be inside transaction)
    const config = await this.stageConfigService.getConfigForStage(toStatus);
    if (!config) {
      this.logger.debug(
        `No stage config for status ${toStatus} — skipping assignment creation for order ${orderId}`,
      );
      return null;
    }

    // Determine primary role for the assignment
    const primaryRole =
      config.primaryRoles.length > 0
        ? (config.primaryRoles[0] as UserRole)
        : UserRole.WAREHOUSE_MANAGER;

    // Determine assignee: Sales-owned stages get the order's sale owner
    let resolvedAssigneeId: string | null = null;

    if (SALE_OWNED_STAGES.has(toStatus)) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { saleId: true },
      });
      resolvedAssigneeId = order?.saleId ?? null;
    }

    // Calculate SLA deadline
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + config.slaHours * 60 * 60 * 1000);

    // Wrap complete-old + create-new in a single transaction
    const assignment = await this.prisma.$transaction(async (tx) => {
      // Complete any active assignments for this order
      await tx.orderAssignment.updateMany({
        where: {
          orderId,
          status: AssignmentStatus.ACTIVE,
        },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: now,
        },
      });

      // Create new assignment for the incoming stage
      return tx.orderAssignment.create({
        data: {
          orderId,
          stage: toStatus,
          departmentCode: config.departmentCode,
          assigneeId: resolvedAssigneeId,
          assigneeRole: primaryRole,
          status: AssignmentStatus.ACTIVE,
          assignedAt: now,
          slaDeadline,
          isOverdue: false,
        },
      });
    });

    this.logger.log(
      `Created assignment ${assignment.id} for order ${orderId} at stage ${toStatus} (dept: ${config.departmentCode}, SLA: ${slaDeadline.toISOString()})`,
    );

    return {
      assignmentId: assignment.id,
      orderId: assignment.orderId,
      stage: assignment.stage,
      departmentCode: assignment.departmentCode,
      assigneeId: assignment.assigneeId,
      assigneeRole: assignment.assigneeRole,
      slaDeadline: assignment.slaDeadline,
    };
  }

  /**
   * Returns the currently active assignment for an order, if any.
   */
  async getActiveAssignment(orderId: string) {
    return this.prisma.orderAssignment.findFirst({
      where: { orderId, status: AssignmentStatus.ACTIVE },
      include: {
        order: { select: { id: true, code: true, status: true } },
      },
    });
  }

  /**
   * Marks an assignment as ESCALATED (triggered by SLA breach escalation logic).
   */
  async escalateAssignment(assignmentId: string): Promise<void> {
    await this.prisma.orderAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.ESCALATED, isOverdue: true },
    });
  }

  /**
   * Marks an assignment as overdue. Called by the SLA checker scheduler.
   */
  async markOverdue(assignmentId: string): Promise<void> {
    await this.prisma.orderAssignment.update({
      where: { id: assignmentId },
      data: { isOverdue: true },
    });
  }
}
