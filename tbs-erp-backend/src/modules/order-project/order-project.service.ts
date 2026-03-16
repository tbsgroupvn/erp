import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { AssignmentStatus, UserRole } from '@prisma/client';
import { OrderProjectRepository } from './order-project.repository';
import { HandoffTrackerService } from './domain/handoff-tracker.service';
import { AutoTaskEngineService } from './domain/auto-task-engine.service';

/** Cache TTL for project view: 2 minutes. */
const PROJECT_VIEW_CACHE_TTL_MS = 120_000;

/** Department codes mapped from user roles. */
const ROLE_TO_DEPARTMENT: Partial<Record<UserRole, string>> = {
  [UserRole.SALE]: 'SALES',
  [UserRole.SALES_LEADER]: 'SALES',
  [UserRole.SALES_DIRECTOR]: 'SALES',
  [UserRole.ACCOUNTANT_AR]: 'FINANCE',
  [UserRole.ACCOUNTANT_COST]: 'FINANCE',
  [UserRole.ACCOUNTANT]: 'FINANCE',
  [UserRole.CHIEF_ACCOUNTANT]: 'FINANCE',
  [UserRole.CFO]: 'FINANCE',
  [UserRole.WAREHOUSE_CN_AGENT]: 'WAREHOUSE_CN',
  [UserRole.LOGISTICS_MANAGER]: 'LOGISTICS',
  [UserRole.XNK_MANAGER]: 'XNK',
  [UserRole.XNK_STAFF]: 'XNK',
  [UserRole.WAREHOUSE_VN_MANAGER]: 'WAREHOUSE_VN',
  [UserRole.WAREHOUSE_VN_STAFF]: 'WAREHOUSE_VN',
  [UserRole.DRIVER]: 'WAREHOUSE_VN',
};

/**
 * OrderProjectService provides the business logic layer over OrderProjectRepository.
 *
 * It adds:
 * - Redis caching for project views (2-minute TTL)
 * - SLA status computation (overdue flag, percent elapsed)
 * - Department board routing by user role
 * - Reassignment with cascading auto-task updates and handoff recording
 */
@Injectable()
export class OrderProjectService {
  private readonly logger = new Logger(OrderProjectService.name);

  constructor(
    private readonly repository: OrderProjectRepository,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly handoffTracker: HandoffTrackerService,
    private readonly autoTaskEngine: AutoTaskEngineService,
  ) {}

  /**
   * Returns the full project view for an order with SLA status computed.
   * Result is cached for 2 minutes.
   */
  async getProjectView(orderId: string) {
    const cacheKey = `order:project:${orderId}`;

    const cached = await this.cacheService.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const rawView = await this.repository.getProjectView(orderId);

    // Compute SLA status for the currently active assignment
    const activeAssignment = rawView.assignments.find(
      (a) => a.status === AssignmentStatus.ACTIVE,
    );

    let sla: { isOverdue: boolean; percentElapsed: number; remainingMs: number | null } = {
      isOverdue: false,
      percentElapsed: 0,
      remainingMs: null,
    };

    if (activeAssignment && activeAssignment.slaDeadline) {
      const now = Date.now();
      const deadlineMs = activeAssignment.slaDeadline.getTime();
      const startMs = activeAssignment.assignedAt.getTime();
      const remainingMs = deadlineMs - now;
      const isOverdue = remainingMs < 0;

      const totalRangeMs = deadlineMs - startMs;
      const elapsedMs = now - startMs;
      const percentElapsed =
        totalRangeMs > 0 ? Math.min(100, Math.round((elapsedMs / totalRangeMs) * 100)) : 100;

      sla = { isOverdue, percentElapsed, remainingMs };
    }

    const result = { ...rawView, sla };

    await this.cacheService.set(cacheKey, result, PROJECT_VIEW_CACHE_TTL_MS);
    return result;
  }

  /**
   * Returns all ACTIVE assignments for the requesting user and their role's queue.
   */
  async getMyAssignments(userId: string, role: UserRole) {
    return this.repository.getMyAssignments(userId, role);
  }

  /**
   * Returns the department board scoped to the user's role.
   *
   * Executives (CEO, COO, DIRECTOR_OPERATIONS) and unmapped roles see all active assignments.
   */
  async getDepartmentBoard(userId: string, role: UserRole) {
    const dept = ROLE_TO_DEPARTMENT[role] ?? null;

    if (!dept) {
      // Executives and unmapped roles see all active assignments across all departments
      this.logger.debug(`Role ${role} has no department mapping — returning all active assignments`);
      return this.repository.getDepartmentBoard(null);
    }

    return this.repository.getDepartmentBoard(dept);
  }

  /**
   * Reassigns an order's active assignment to a different user.
   *
   * Steps:
   * 1. Validate the assignment exists and is ACTIVE
   * 2. Update assigneeId on the assignment
   * 3. Record a REASSIGNMENT handoff
   * 4. If the assignment has a linked auto-task, update its assignee too
   * 5. Invalidate the project view cache
   */
  async reassignOrder(
    orderId: string,
    assignmentId: string,
    newAssigneeId: string,
    requestedBy: string,
  ) {
    // Validate that the target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: newAssigneeId },
      select: { id: true, isActive: true },
    });
    if (!targetUser) {
      throw new BadRequestException(`User ${newAssigneeId} not found`);
    }
    if (!targetUser.isActive) {
      throw new BadRequestException(`User ${newAssigneeId} is inactive`);
    }

    const assignment = await this.repository.findAssignmentById(assignmentId);

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException(
        `Assignment ${assignmentId} is not ACTIVE (current status: ${assignment.status}). Only active assignments can be reassigned.`,
      );
    }

    if (assignment.orderId !== orderId) {
      throw new BadRequestException(
        `Assignment ${assignmentId} does not belong to order ${orderId}`,
      );
    }

    const previousAssigneeId = assignment.assigneeId;

    // Update assignment
    const updated = await this.repository.updateAssignee(assignmentId, newAssigneeId);

    // Record handoff
    await this.handoffTracker.recordHandoff({
      orderId,
      fromStage: assignment.stage,
      toStage: assignment.stage, // Same stage, just different person
      fromDepartment: assignment.departmentCode,
      toDepartment: assignment.departmentCode,
      fromUserId: previousAssigneeId ?? requestedBy,
      toUserId: newAssigneeId,
      toRole: assignment.assigneeRole,
      handoffType: 'REASSIGNMENT',
      note: `Reassigned by user ${requestedBy}`,
    });

    // Update auto-task assignee if one is linked
    if (assignment.autoTaskId) {
      try {
        await this.autoTaskEngine.updateTaskAssignee(assignment.autoTaskId, newAssigneeId);
      } catch (err) {
        // Non-critical: log warning but don't fail the reassignment
        this.logger.warn(
          `Failed to update auto-task ${assignment.autoTaskId} assignee: ${err.message}`,
        );
      }
    }

    // Invalidate cached project view
    await this.cacheService.del(`order:project:${orderId}`);

    this.logger.log(
      `Order ${orderId} assignment ${assignmentId} reassigned from ${previousAssigneeId ?? 'unassigned'} to ${newAssigneeId} by ${requestedBy}`,
    );

    return updated;
  }

  /**
   * Returns assignments for a specific order (for the assignment list endpoint).
   */
  async getAssignmentsByOrder(orderId: string) {
    return this.repository.getAssignmentsByOrder(orderId);
  }

  /**
   * Returns handoffs for a specific order (for the handoff list endpoint).
   */
  async getHandoffsByOrder(orderId: string) {
    return this.repository.getHandoffsByOrder(orderId);
  }
}
