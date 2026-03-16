import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AssignmentStatus, UserRole } from '@prisma/client';

/** Safety limit for list queries to prevent memory spikes */
const DEFAULT_TAKE = 100;
const MAX_TAKE = 500;

/**
 * OrderProjectRepository handles all data-access for the order-project module.
 *
 * It provides efficient single-query aggregations for project views and
 * role-scoped board queries without business logic.
 */
@Injectable()
export class OrderProjectRepository {
  private readonly logger = new Logger(OrderProjectRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a complete project view for a single order:
   * - assignments (newest first, with assignee name)
   * - handoffs (newest first)
   * - auto-created tasks linked to the order (with assignee name)
   * - order status and code for context
   */
  async getProjectView(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        status: true,
        customer: { select: { id: true, companyName: true } },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            order: false,
          },
        },
        handoffs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Fetch assignee details for assignments separately (no direct relation in schema)
    const assigneeIds = order.assignments
      .map((a) => a.assigneeId)
      .filter((id): id is string => id !== null);

    const assignees =
      assigneeIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, fullName: true },
          })
        : [];

    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

    const assignmentsWithAssignee = order.assignments.map((a) => ({
      ...a,
      assignee: a.assigneeId ? (assigneeMap.get(a.assigneeId) ?? null) : null,
    }));

    // Fetch auto-created tasks for this order
    const autoTasks = await this.prisma.task.findMany({
      where: {
        entityType: 'ORDER',
        entityId: orderId,
        isAutoCreated: true,
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      orderId: order.id,
      orderCode: order.code,
      orderStatus: order.status,
      customer: order.customer,
      assignments: assignmentsWithAssignee,
      handoffs: order.handoffs,
      autoTasks,
    };
  }

  /**
   * Returns all assignments for an order, newest first, with assignee name.
   */
  async getAssignmentsByOrder(orderId: string) {
    const assignments = await this.prisma.orderAssignment.findMany({
      where: { orderId },
      orderBy: { assignedAt: 'desc' },
    });

    const assigneeIds = assignments
      .map((a) => a.assigneeId)
      .filter((id): id is string => id !== null);

    const assignees =
      assigneeIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, fullName: true },
          })
        : [];

    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

    return assignments.map((a) => ({
      ...a,
      assignee: a.assigneeId ? (assigneeMap.get(a.assigneeId) ?? null) : null,
    }));
  }

  /**
   * Returns all handoffs for an order, newest first.
   */
  async getHandoffsByOrder(orderId: string, take = DEFAULT_TAKE, skip = 0) {
    return this.prisma.orderHandoff.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, MAX_TAKE),
      skip,
    });
  }

  /**
   * Returns all ACTIVE assignments for a specific user or role-level queue.
   *
   * A user sees:
   * - Assignments explicitly assigned to them (assigneeId = userId)
   * - Unassigned assignments in their role's queue (assigneeId null, assigneeRole = role)
   */
  async getMyAssignments(userId: string, role: UserRole, take = DEFAULT_TAKE, skip = 0) {
    const limit = Math.min(take, MAX_TAKE);
    const assignments = await this.prisma.orderAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        OR: [
          { assigneeId: userId },
          { assigneeId: null, assigneeRole: role },
        ],
      },
      orderBy: { slaDeadline: 'asc' },
      take: limit,
      skip,
    });

    if (assignments.length === 0) return [];

    const orderIds = [...new Set(assignments.map((a) => a.orderId))];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        code: true,
        status: true,
        saleId: true,
        customer: { select: { id: true, companyName: true } },
      },
    });

    const orderMap = new Map(orders.map((o) => [o.id, o]));

    return assignments.map((a) => ({
      ...a,
      order: orderMap.get(a.orderId) ?? null,
    }));
  }

  /**
   * Returns all ACTIVE assignments for a department, with order context.
   * Pass null for departmentCode to return assignments for all departments
   * (used by executives and unmapped roles).
   */
  async getDepartmentBoard(departmentCode: string | null, take = DEFAULT_TAKE, skip = 0) {
    const limit = Math.min(take, MAX_TAKE);
    const assignments = await this.prisma.orderAssignment.findMany({
      where: {
        ...(departmentCode ? { departmentCode } : {}),
        status: AssignmentStatus.ACTIVE,
      },
      orderBy: [{ isOverdue: 'desc' }, { slaDeadline: 'asc' }],
      take: limit,
      skip,
    });

    if (assignments.length === 0) return [];

    const orderIds = [...new Set(assignments.map((a) => a.orderId))];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        code: true,
        status: true,
        saleId: true,
        customer: { select: { id: true, companyName: true } },
      },
    });

    const orderMap = new Map(orders.map((o) => [o.id, o]));

    return assignments.map((a) => ({
      ...a,
      order: orderMap.get(a.orderId) ?? null,
    }));
  }

  /**
   * Finds a single assignment by ID, throws NotFoundException if missing.
   */
  async findAssignmentById(assignmentId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    return assignment;
  }

  /**
   * Updates an assignment's assigneeId (used during reassignment).
   */
  async updateAssignee(assignmentId: string, newAssigneeId: string) {
    return this.prisma.orderAssignment.update({
      where: { id: assignmentId },
      data: { assigneeId: newAssigneeId },
    });
  }
}
