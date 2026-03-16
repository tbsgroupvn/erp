import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApprovalAction, ApprovalStatus, ApprovalType } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import type { ApprovalCompletedEvent } from '../listeners/approval-completed.listener';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ApprovalOverview {
  totalApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  /** Percentage 0–100, or null if no terminal approvals yet */
  approvalRate: number | null;
  /** Average total duration in milliseconds, or null if no data */
  avgDurationMs: number | null;
  /** Percentage of approvals that were overdue, 0–100 */
  slaBreachRate: number | null;
  pendingCount: number;
}

export interface BottleneckEntry {
  role: string;
  count: number;
  avgDurationMs: number | null;
}

export interface TypeBreakdownEntry {
  type: string;
  total: number;
  approvedCount: number;
  rejectedCount: number;
  avgDurationMs: number | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Approval analytics service.
 *
 * Responsibilities:
 *  1. Listen for `approval.completed` events and persist an ApprovalAnalytics
 *     record (upsert) that captures duration, per-step breakdown, bottleneck
 *     role, escalation flag and overdue flag.
 *  2. Expose read queries for overview stats, bottleneck analysis and
 *     type breakdown — all scoped to a caller-supplied date range.
 */
@Injectable()
export class ApprovalAnalyticsService {
  private readonly logger = new Logger(ApprovalAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Event listener
  // -------------------------------------------------------------------------

  /**
   * Record analytics when an approval is completed (approved OR rejected).
   *
   * Steps:
   *  1. Load approval with all steps and action logs.
   *  2. Calculate total duration from createdAt → now.
   *  3. Calculate per-step durations using decidedAt (or updatedAt) − step.createdAt.
   *  4. Find the bottleneck step (longest individual duration).
   *  5. Determine wasEscalated (any AUTO_ESCALATE action log entry).
   *  6. Determine wasOverdue (any step with isOverdue = true, or past deadlineAt).
   *  7. Upsert into ApprovalAnalytics.
   */
  @OnEvent('approval.completed')
  async recordCompletion(event: ApprovalCompletedEvent): Promise<void> {
    try {
      const approval = await this.prisma.approval.findUnique({
        where: { id: event.approvalId },
        include: {
          steps: { orderBy: { stepNumber: 'asc' } },
          actionLogs: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!approval) {
        this.logger.warn(`recordCompletion: approval ${event.approvalId} not found`);
        return;
      }

      const now = new Date();

      // 1. Total duration in ms (BigInt — avoids JS precision loss on large values)
      const totalDurationMs = BigInt(now.getTime() - approval.createdAt.getTime());

      // 2. Per-step durations: { stepNumber -> durationMs }
      // Use decidedAt if available, otherwise fall back to updatedAt.
      const stepDurations: Record<number, number> = {};

      for (const step of approval.steps) {
        const endTime = step.decidedAt ?? step.updatedAt;
        const durationMs = endTime.getTime() - step.createdAt.getTime();
        stepDurations[step.stepNumber] = Math.max(0, durationMs);
      }

      // 3. Bottleneck: step with the longest individual duration
      let bottleneckStep: number | null = null;
      let bottleneckRole: string | null = null;
      let maxStepDuration = -1;

      for (const step of approval.steps) {
        const d = stepDurations[step.stepNumber] ?? 0;
        if (d > maxStepDuration) {
          maxStepDuration = d;
          bottleneckStep = step.stepNumber;
          bottleneckRole = step.approverRole;
        }
      }

      // 4. wasEscalated: any action log has AUTO_ESCALATE
      const wasEscalated = approval.actionLogs.some(
        (log) => log.action === ApprovalAction.AUTO_ESCALATE,
      );

      // 5. wasOverdue: any step has isOverdue=true, or step exceeded its deadlineAt
      const wasOverdue =
        approval.steps.some((step) => step.isOverdue) ||
        approval.steps.some(
          (step) =>
            step.deadlineAt != null &&
            (step.decidedAt ?? now) > step.deadlineAt,
        );

      // 6. Final status from event payload (string); map to ApprovalStatus enum
      const finalStatus =
        event.status === 'APPROVED' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

      // 7. Upsert ApprovalAnalytics
      await this.prisma.approvalAnalytics.upsert({
        where: { approvalId: event.approvalId },
        create: {
          approvalId: event.approvalId,
          type: approval.type as ApprovalType,
          flowDefinitionId: approval.flowDefinitionId ?? null,
          totalDurationMs,
          stepDurations,
          bottleneckStep,
          bottleneckRole,
          wasEscalated,
          wasOverdue,
          finalStatus,
          completedAt: now,
        },
        update: {
          totalDurationMs,
          stepDurations,
          bottleneckStep,
          bottleneckRole,
          wasEscalated,
          wasOverdue,
          finalStatus,
          completedAt: now,
        },
      });

      this.logger.log(
        `Analytics recorded: approvalId=${event.approvalId} type=${approval.type} ` +
          `status=${finalStatus} durationMs=${totalDurationMs} bottleneckStep=${bottleneckStep}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to record analytics for approval ${event.approvalId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Do NOT rethrow — analytics failures must never block the main flow
    }
  }

  // -------------------------------------------------------------------------
  // Read queries
  // -------------------------------------------------------------------------

  /**
   * Overview statistics for a date range (based on completedAt).
   *
   * Returns counts, approval rate, average duration and SLA breach rate.
   * Pending approvals are counted separately using the main Approval table
   * (since they have no completedAt).
   */
  async getOverview(dateFrom: Date, dateTo: Date): Promise<ApprovalOverview> {
    const [completed, pending] = await Promise.all([
      this.prisma.approvalAnalytics.findMany({
        where: {
          completedAt: { gte: dateFrom, lte: dateTo },
        },
        select: {
          finalStatus: true,
          totalDurationMs: true,
          wasOverdue: true,
        },
      }),
      this.prisma.approval.count({
        where: { status: ApprovalStatus.PENDING },
      }),
    ]);

    const totalApprovals = completed.length;
    const approvedCount = completed.filter(
      (r) => r.finalStatus === ApprovalStatus.APPROVED,
    ).length;
    const rejectedCount = completed.filter(
      (r) => r.finalStatus === ApprovalStatus.REJECTED,
    ).length;

    const approvalRate =
      totalApprovals > 0
        ? Math.round((approvedCount / totalApprovals) * 10000) / 100
        : null;

    // Average duration — convert BigInt to number safely
    // BigInt precision loss only becomes problematic beyond ~9 quadrillion ms;
    // for realistic approval durations (< 30 days) Number() is safe.
    const durationsWithValue = completed.filter((r) => r.totalDurationMs != null);
    const avgDurationMs =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce((sum, r) => sum + Number(r.totalDurationMs!), 0) /
          durationsWithValue.length
        : null;

    const overdueCount = completed.filter((r) => r.wasOverdue).length;
    const slaBreachRate =
      totalApprovals > 0
        ? Math.round((overdueCount / totalApprovals) * 10000) / 100
        : null;

    return {
      totalApprovals,
      approvedCount,
      rejectedCount,
      approvalRate,
      avgDurationMs: avgDurationMs !== null ? Math.round(avgDurationMs) : null,
      slaBreachRate,
      pendingCount: pending,
    };
  }

  /**
   * Bottleneck analysis: which roles most often hold up approvals.
   *
   * Groups by bottleneckRole, counts occurrences, and computes average
   * duration of the bottleneck step. Results are sorted by count descending.
   */
  async getBottlenecks(dateFrom: Date, dateTo: Date): Promise<BottleneckEntry[]> {
    const rows = await this.prisma.approvalAnalytics.findMany({
      where: {
        completedAt: { gte: dateFrom, lte: dateTo },
        bottleneckRole: { not: null },
      },
      select: {
        bottleneckRole: true,
        totalDurationMs: true,
        stepDurations: true,
        bottleneckStep: true,
      },
    });

    // Aggregate in-process (cheaper than a raw groupBy for moderate data sets)
    const roleMap = new Map<string, { count: number; totalMs: number; durationCount: number }>();

    for (const row of rows) {
      const role = row.bottleneckRole!;
      const entry = roleMap.get(role) ?? { count: 0, totalMs: 0, durationCount: 0 };
      entry.count++;

      // Extract the bottleneck step duration from the stored JSON
      if (row.bottleneckStep != null && row.stepDurations != null) {
        const durations = row.stepDurations as Record<string, number>;
        const stepDurationMs = durations[String(row.bottleneckStep)];
        if (typeof stepDurationMs === 'number') {
          entry.totalMs += stepDurationMs;
          entry.durationCount++;
        }
      }

      roleMap.set(role, entry);
    }

    const result: BottleneckEntry[] = [];

    for (const [role, data] of roleMap.entries()) {
      result.push({
        role,
        count: data.count,
        avgDurationMs:
          data.durationCount > 0 ? Math.round(data.totalMs / data.durationCount) : null,
      });
    }

    // Sort by count descending, then by role name for deterministic ordering
    result.sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));

    return result;
  }

  /**
   * Breakdown of analytics by approval type.
   *
   * For each type present in the date range: total count, approved/rejected
   * counts and average total duration.
   */
  async getTypeBreakdown(dateFrom: Date, dateTo: Date): Promise<TypeBreakdownEntry[]> {
    const rows = await this.prisma.approvalAnalytics.findMany({
      where: {
        completedAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        type: true,
        finalStatus: true,
        totalDurationMs: true,
      },
    });

    const typeMap = new Map<
      string,
      { total: number; approved: number; rejected: number; totalMs: number; durationCount: number }
    >();

    for (const row of rows) {
      const key = row.type as string;
      const entry = typeMap.get(key) ?? {
        total: 0,
        approved: 0,
        rejected: 0,
        totalMs: 0,
        durationCount: 0,
      };

      entry.total++;

      if (row.finalStatus === ApprovalStatus.APPROVED) {
        entry.approved++;
      } else if (row.finalStatus === ApprovalStatus.REJECTED) {
        entry.rejected++;
      }

      if (row.totalDurationMs != null) {
        entry.totalMs += Number(row.totalDurationMs);
        entry.durationCount++;
      }

      typeMap.set(key, entry);
    }

    const result: TypeBreakdownEntry[] = [];

    for (const [type, data] of typeMap.entries()) {
      result.push({
        type,
        total: data.total,
        approvedCount: data.approved,
        rejectedCount: data.rejected,
        avgDurationMs:
          data.durationCount > 0 ? Math.round(data.totalMs / data.durationCount) : null,
      });
    }

    // Sort by total count descending for readability
    result.sort((a, b) => b.total - a.total || a.type.localeCompare(b.type));

    return result;
  }
}
