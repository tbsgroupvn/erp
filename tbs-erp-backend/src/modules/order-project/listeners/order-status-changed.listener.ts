import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus, AssignmentStatus, ServiceType } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { StageConfigService } from '../domain/stage-config.service';
import { AssignmentEngineService } from '../domain/assignment-engine.service';
import { AutoTaskEngineService } from '../domain/auto-task-engine.service';
import { HandoffTrackerService } from '../domain/handoff-tracker.service';

/** Terminal statuses — no auto-task needed when entering these. */
const TERMINAL_STAGES = new Set<OrderStatus>([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
]);

/** Idempotency lock TTL: 30 seconds (prevents duplicate event processing) */
const IDEMPOTENCY_TTL_MS = 30_000;

export interface OrderStatusChangedEvent {
  orderId: string;
  code: string;
  customerId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedBy: string;
  serviceType: ServiceType;
}

/**
 * Listens for 'order.status.changed' events and orchestrates the order-project
 * assignment and auto-task lifecycle.
 *
 * Handler is fire-and-forget: errors are caught and logged but never re-thrown,
 * ensuring the calling process is never blocked by project management side-effects.
 */
@Injectable()
export class OrderStatusChangedListener {
  private readonly logger = new Logger(OrderStatusChangedListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentEngine: AssignmentEngineService,
    private readonly handoffTracker: HandoffTrackerService,
    private readonly stageConfigService: StageConfigService,
    private readonly autoTaskEngine: AutoTaskEngineService,
    private readonly cacheService: CacheService,
  ) {}

  @OnEvent('order.status.changed', { async: true })
  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const { orderId, code, fromStatus, toStatus, changedBy } = event;

    this.logger.log(
      `order.status.changed received: order=${orderId} (${code}) ${fromStatus}->${toStatus} by=${changedBy}`,
    );

    // Idempotency guard: prevent duplicate processing of the same transition
    const idempotencyKey = `order-project:lock:${orderId}:${fromStatus}:${toStatus}`;
    const alreadyProcessing = await this.cacheService.get(idempotencyKey);
    if (alreadyProcessing) {
      this.logger.warn(`Duplicate event skipped: ${idempotencyKey}`);
      return;
    }
    await this.cacheService.set(idempotencyKey, true, IDEMPOTENCY_TTL_MS);

    try {
      // Step 1: Find the old ACTIVE assignment before completing it (for handoff tracking)
      const oldAssignment = await this.prisma.orderAssignment.findFirst({
        where: { orderId, status: AssignmentStatus.ACTIVE },
        select: { assigneeId: true, departmentCode: true, assignedAt: true },
      });

      // Step 2: Complete old assignment and create new one via assignment engine
      const newAssignment = await this.assignmentEngine.handleStageTransition(
        orderId,
        fromStatus,
        toStatus,
        changedBy,
      );

      // Step 3: Record handoff if both old and new assignments exist
      if (newAssignment) {
        const fromDepartment = oldAssignment?.departmentCode ?? 'UNKNOWN';
        const durationMinutes = oldAssignment?.assignedAt
          ? this.handoffTracker.computeDuration(oldAssignment.assignedAt)
          : undefined;

        await this.handoffTracker.recordHandoff({
          orderId,
          fromStage: fromStatus,
          toStage: toStatus,
          fromDepartment,
          toDepartment: newAssignment.departmentCode,
          fromUserId: oldAssignment?.assigneeId ?? changedBy,
          toUserId: newAssignment.assigneeId,
          toRole: newAssignment.assigneeRole,
          handoffType: 'STAGE_TRANSITION',
          durationMinutes,
        });
      }

      // Step 4: Auto-create task for the new stage
      const config = await this.stageConfigService.getConfigForStage(toStatus);

      if (config && !TERMINAL_STAGES.has(toStatus) && newAssignment) {
        const taskId = await this.autoTaskEngine.createStageTask({
          orderId,
          orderCode: code,
          stage: toStatus,
          config,
          assigneeId: newAssignment.assigneeId,
          slaDeadline: newAssignment.slaDeadline,
          triggeredBy: changedBy,
        });

        // Link auto-task to assignment
        if (taskId) {
          await this.prisma.orderAssignment.update({
            where: { id: newAssignment.assignmentId },
            data: { autoTaskId: taskId },
          });
        }
      }

      // Step 5: Invalidate cached project view
      await this.cacheService.del(`order:project:${orderId}`);
    } catch (err) {
      this.logger.error(
        `order.status.changed handler failed for order ${orderId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
