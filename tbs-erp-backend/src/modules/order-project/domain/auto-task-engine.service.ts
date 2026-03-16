import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { TaskStatus, TaskPriority, OrderStatus } from '@prisma/client';
import { StageConfig } from './stage-config.service';

/**
 * AutoTaskEngineService creates Task records automatically when an order enters a
 * new lifecycle stage. The task title and description are derived from the stage
 * config template, with order-specific placeholders interpolated.
 *
 * Auto-created tasks are linked to the order via entityType/entityId and have
 * isAutoCreated=true so they can be distinguished from manually created tasks.
 */
@Injectable()
export class AutoTaskEngineService {
  private readonly logger = new Logger(AutoTaskEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Creates an auto-task for an order stage transition.
   *
   * NOTE: Task.assigneeId and Task.createdBy are non-nullable FK columns.
   * When no specific assignee is known, the triggering user (changedBy) is used
   * as both assigneeId and createdBy so the task is actionable from the start.
   * If no changedBy is provided, task creation is skipped to avoid a DB constraint error.
   *
   * Returns the created task ID, or null if creation is skipped.
   */
  async createStageTask(params: {
    orderId: string;
    orderCode: string;
    stage: OrderStatus;
    config: StageConfig;
    assigneeId?: string | null;
    slaDeadline?: Date | null;
    /** User who triggered the stage change — used as createdBy and fallback assignee. */
    triggeredBy?: string;
  }): Promise<string | null> {
    const { orderId, orderCode, stage, config, assigneeId, slaDeadline, triggeredBy } = params;

    // Determine a valid assignee: prefer explicit assignee, fall back to triggeredBy
    const resolvedAssigneeId = assigneeId ?? triggeredBy ?? null;

    if (!resolvedAssigneeId) {
      // Cannot create task without a valid assignee — skip silently
      this.logger.debug(
        `Skipping auto-task for order ${orderId} stage ${stage} — no assignee or triggeredBy provided`,
      );
      return null;
    }

    // Prevent duplicate auto-tasks for the same order+stage
    const existing = await this.prisma.task.findFirst({
      where: {
        entityType: 'ORDER',
        entityId: orderId,
        isAutoCreated: true,
        orderStage: stage,
      },
      select: { id: true },
    });

    if (existing) {
      this.logger.debug(
        `Auto-task already exists for order ${orderId} at stage ${stage} — skipping creation`,
      );
      return existing.id;
    }

    // Interpolate order code into the task title template
    const title = config.taskTitle.replace('{{code}}', orderCode).replace('{{stage}}', stage);
    const description = config.taskDescription
      ? config.taskDescription.replace('{{code}}', orderCode).replace('{{stage}}', stage)
      : null;

    // Generate a unique task code via Redis atomic counter (race-safe)
    const taskCode = await this.generateTaskCode();

    // Create task inside a transaction alongside the idempotency check
    // to prevent duplicates under concurrent transitions
    const task = await this.prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent race
      const dup = await tx.task.findFirst({
        where: {
          entityType: 'ORDER',
          entityId: orderId,
          isAutoCreated: true,
          orderStage: stage,
        },
        select: { id: true },
      });
      if (dup) return dup;

      return tx.task.create({
        data: {
          code: taskCode,
          title,
          description,
          entityType: 'ORDER',
          entityId: orderId,
          assigneeId: resolvedAssigneeId,
          status: TaskStatus.OPEN,
          priority: TaskPriority.HIGH,
          dueDate: slaDeadline ?? undefined,
          isAutoCreated: true,
          orderStage: stage,
          departmentCode: config.departmentCode,
          tags: [stage, config.departmentCode],
          createdBy: triggeredBy ?? resolvedAssigneeId,
        },
      });
    });

    this.logger.log(
      `Auto-task ${task.id} (${taskCode}) created for order ${orderId} at stage ${stage} (assignee=${resolvedAssigneeId})`,
    );

    return task.id;
  }

  /**
   * Updates the assignee of an auto-task when the corresponding assignment is reassigned.
   */
  async updateTaskAssignee(taskId: string, newAssigneeId: string): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: newAssigneeId },
    });
  }

  /**
   * Closes an auto-task when its stage is completed.
   */
  async closeStageTask(taskId: string): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Generates a task code using Redis INCR for atomicity.
   * Falls back to DB query if Redis is unavailable.
   */
  private async generateTaskCode(): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `TSK-${yyyymm}-`;
    const redisKey = `task:code:seq:${yyyymm}`;

    try {
      // Redis INCR is atomic — no race condition
      const seq = await this.cacheService.incr(redisKey);
      // Set expiry on first use (60 days covers any month)
      if (seq === 1) {
        await this.cacheService.expire(redisKey, 60 * 86400);
      }
      return `${prefix}${String(seq).padStart(4, '0')}`;
    } catch {
      // Fallback: DB-based generation (less safe under high concurrency)
      this.logger.warn('Redis unavailable for task code generation, falling back to DB');
      const lastTask = await this.prisma.task.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });

      let seq = 1;
      if (lastTask) {
        const parts = lastTask.code.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      return `${prefix}${String(seq).padStart(4, '0')}`;
    }
  }
}
