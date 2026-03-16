import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { AssignmentStatus } from '@prisma/client';
import { StageConfigService } from './stage-config.service';

/**
 * SLACheckerService runs a periodic job to detect overdue assignments.
 *
 * Every 15 minutes it scans for ACTIVE assignments where:
 * - slaDeadline is in the past
 * - isOverdue is still false
 *
 * For each breach it:
 * 1. Marks the assignment isOverdue=true
 * 2. Emits 'order.assignment.sla.breached' so the listener can send notifications
 */
@Injectable()
export class SLACheckerService {
  private readonly logger = new Logger(SLACheckerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
    private readonly stageConfigService: StageConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSLABreaches(): Promise<void> {
    const now = new Date();

    try {
      // Step 1: Batch-mark all newly overdue assignments in a single query
      const updated = await this.prisma.orderAssignment.updateMany({
        where: {
          status: AssignmentStatus.ACTIVE,
          isOverdue: false,
          slaDeadline: { lt: now },
        },
        data: { isOverdue: true },
      });

      if (updated.count === 0) return;

      this.logger.warn(`SLA check: marked ${updated.count} assignment(s) as overdue`);

      // Step 2: Fetch the just-marked assignments (limited batch) for event emission
      const breached = await this.prisma.orderAssignment.findMany({
        where: {
          status: AssignmentStatus.ACTIVE,
          isOverdue: true,
          slaDeadline: { lt: now },
        },
        select: {
          id: true,
          orderId: true,
          stage: true,
          departmentCode: true,
          assigneeId: true,
          slaDeadline: true,
        },
        take: 200, // Cap per cycle to avoid memory spikes
        orderBy: { slaDeadline: 'asc' },
      });

      // Step 3: Emit events for notifications
      for (const assignment of breached) {
        this.eventEmitter.emit('order.assignment.sla.breached', {
          orderId: assignment.orderId,
          assignmentId: assignment.id,
          stage: assignment.stage,
          departmentCode: assignment.departmentCode,
          assigneeId: assignment.assigneeId,
          slaDeadline: assignment.slaDeadline,
        });
      }
    } catch (err) {
      this.logger.error(`SLA check cron failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Checks for assignments approaching SLA deadline (warning window).
   * Uses slaWarningHours from StageConfig. Fires at most once per assignment.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSLAWarnings(): Promise<void> {
    try {
      const now = new Date();
      const configs = await this.stageConfigService.getAllActiveConfigs();
      const warningConfigs = configs.filter((c) => c.slaWarningHours != null && c.slaWarningHours > 0);

      if (warningConfigs.length === 0) return;

      // For each stage with a warning window, find assignments within the warning zone
      for (const config of warningConfigs) {
        const warningThreshold = new Date(
          now.getTime() + config.slaWarningHours! * 60 * 60 * 1000,
        );

        const atRisk = await this.prisma.orderAssignment.findMany({
          where: {
            status: AssignmentStatus.ACTIVE,
            stage: config.stage,
            isOverdue: false,
            slaDeadline: { gt: now, lte: warningThreshold },
          },
          select: {
            id: true,
            orderId: true,
            stage: true,
            departmentCode: true,
            assigneeId: true,
            slaDeadline: true,
          },
          take: 100,
        });

        for (const assignment of atRisk) {
          // Fire-once: use cache key to avoid spamming warnings
          const warnKey = `sla:warned:${assignment.id}`;
          const alreadyWarned = await this.cacheService.get(warnKey);
          if (alreadyWarned) continue;

          await this.cacheService.set(warnKey, true, config.slaHours * 60 * 60 * 1000);

          this.eventEmitter.emit('order.assignment.sla.warning', {
            orderId: assignment.orderId,
            assignmentId: assignment.id,
            stage: assignment.stage,
            departmentCode: assignment.departmentCode,
            assigneeId: assignment.assigneeId,
            slaDeadline: assignment.slaDeadline,
            warningHours: config.slaWarningHours,
          });
        }
      }
    } catch (err) {
      this.logger.error(`SLA warning check failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Returns all currently active overdue assignments for monitoring/dashboard use.
   */
  async getOverdueAssignments() {
    return this.prisma.orderAssignment.findMany({
      where: {
        status: AssignmentStatus.ACTIVE,
        isOverdue: true,
      },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            customer: { select: { id: true, companyName: true } },
          },
        },
      },
      orderBy: { slaDeadline: 'asc' },
    });
  }
}
