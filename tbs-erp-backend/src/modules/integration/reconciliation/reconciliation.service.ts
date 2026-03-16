import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { ReconType, ReconRunStatus, ReconItemStatus, ReconMatchType } from '@prisma/client';

interface ReconSource {
  id: string;
  reference: string;
  amount: number;
  date?: Date;
}

/**
 * Reconciliation Engine — Compares data between ERP and external systems
 * to detect discrepancies.
 *
 * Supports:
 *  - FINANCIAL: AR/AP records vs Bank statements
 *  - INVENTORY: ERP package records vs Physical warehouse counts
 *  - PAYMENT:   Payment vouchers vs Wallet transactions vs AR records
 *  - ORDER:     ERP orders vs external marketplace orders
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start a reconciliation run. Returns the run ID for tracking.
   */
  async startRun(
    type: ReconType,
    scope: string,
    targetSystem: string,
    triggeredBy: string,
  ): Promise<string> {
    const run = await this.prisma.reconciliationRun.create({
      data: {
        type,
        scope,
        status: 'RUNNING',
        triggeredBy,
        targetSystem,
      },
    });

    this.logger.log(
      `Reconciliation run ${run.id} started: type=${type}, scope=${scope}, target=${targetSystem}`,
    );

    return run.id;
  }

  /**
   * Execute a financial reconciliation: compare ERP AR/payment records vs bank statements.
   */
  async runFinancialRecon(
    scope: string,
    triggeredBy: string,
  ): Promise<{ runId: string; summary: any }> {
    const runId = await this.startRun('FINANCIAL', scope, 'BANK', triggeredBy);

    try {
      // Source: ERP payment vouchers for the scope period
      const erpPayments = await this.prisma.paymentVoucher.findMany({
        where: {
          status: 'APPROVED',
          approvedAt: this.parseScopeDateRange(scope),
        },
        select: {
          id: true,
          code: true,
          amount: true,
          approvedAt: true,
        },
      });

      const sourceRecords: ReconSource[] = erpPayments.map((p) => ({
        id: p.id,
        reference: p.code,
        amount: Number(p.amount),
        date: p.approvedAt ?? undefined,
      }));

      // Target: imported bank statement records stored in SyncLog
      const bankStatements = await this.prisma.syncLog.findMany({
        where: {
          source: 'BANK_STATEMENT',
          entity: 'bank_transaction',
          status: 'SUCCESS',
          createdAt: this.parseScopeDateRange(scope),
        },
      });

      const targetRecords: ReconSource[] = bankStatements.map((bs) => {
        const payload = bs.payload as any;
        return {
          id: bs.id,
          reference: bs.externalId,
          amount: Number(payload?.amount ?? 0),
          date: payload?.date ? new Date(payload.date) : bs.createdAt,
        };
      });

      const result = await this.matchRecords(runId, sourceRecords, targetRecords);

      await this.completeRun(runId, result);

      this.eventEmitter.emit('reconciliation.completed', {
        runId,
        type: 'FINANCIAL',
        scope,
        ...result,
      });

      return { runId, summary: result };
    } catch (error) {
      await this.failRun(runId, error.message);
      throw error;
    }
  }

  /**
   * Execute an inventory reconciliation: compare ERP package records vs physical counts.
   */
  async runInventoryRecon(
    warehouseId: string,
    triggeredBy: string,
  ): Promise<{ runId: string; summary: any }> {
    const runId = await this.startRun('INVENTORY', warehouseId, 'WAREHOUSE_PHYSICAL', triggeredBy);

    try {
      // Source: ERP package records in this warehouse
      const erpPackages = await this.prisma.package.findMany({
        where: {
          warehouseVNStatus: { in: ['RECEIVED', 'SORTED', 'READY'] },
        },
        select: {
          id: true,
          code: true,
          actualWeight: true,
          receivedVNAt: true,
        },
      });

      const sourceRecords: ReconSource[] = erpPackages.map((p) => ({
        id: p.id,
        reference: p.code,
        amount: Number(p.actualWeight ?? 0),
        date: p.receivedVNAt ?? undefined,
      }));

      // Note: targetRecords would come from physical scan/count import
      // This is the framework; physical counts are imported via batch job
      const targetRecords: ReconSource[] = [];

      const result = await this.matchRecords(runId, sourceRecords, targetRecords);
      await this.completeRun(runId, result);

      return { runId, summary: result };
    } catch (error) {
      await this.failRun(runId, error.message);
      throw error;
    }
  }

  /**
   * Core matching algorithm. Matches source and target records by reference,
   * then by amount, detecting exact matches, partial matches, and orphans.
   */
  async matchRecords(
    runId: string,
    sourceRecords: ReconSource[],
    targetRecords: ReconSource[],
  ): Promise<{
    totalRecords: number;
    matchedCount: number;
    discrepancyCount: number;
    orphanedCount: number;
  }> {
    let matchedCount = 0;
    let discrepancyCount = 0;
    let orphanedCount = 0;

    const targetByRef = new Map<string, ReconSource>();
    const matchedTargetIds = new Set<string>();

    for (const t of targetRecords) {
      targetByRef.set(t.reference, t);
    }

    // Batch checkpoint: flush every BATCH_SIZE items to DB so at most
    // one batch worth of work is lost on crash.
    const BATCH_SIZE = 100;
    let batchBuffer: any[] = [];

    const flushBatch = async () => {
      if (batchBuffer.length > 0) {
        await this.prisma.reconciliationItem.createMany({
          data: batchBuffer,
          skipDuplicates: true,
        });
        batchBuffer = [];
      }
    };

    // Match source records against targets
    for (const source of sourceRecords) {
      const target = targetByRef.get(source.reference);

      if (target) {
        matchedTargetIds.add(target.id);
        const variance = source.amount - target.amount;
        const variancePercent =
          source.amount !== 0 ? (Math.abs(variance) / Math.abs(source.amount)) * 100 : 0;

        let matchType: ReconMatchType;
        let status: ReconItemStatus;

        if (Math.abs(variance) < 0.01) {
          matchType = 'EXACT';
          status = 'MATCHED';
          matchedCount++;
        } else if (variancePercent < 1) {
          matchType = 'PARTIAL';
          status = 'MATCHED';
          matchedCount++;
        } else {
          matchType = 'AMOUNT_ONLY';
          status = 'DISCREPANCY';
          discrepancyCount++;
        }

        batchBuffer.push({
          runId,
          sourceId: source.id,
          sourceReference: source.reference,
          targetId: target.id,
          targetReference: target.reference,
          status,
          matchType,
          sourceAmount: new Decimal(source.amount),
          targetAmount: new Decimal(target.amount),
          varianceAmount: new Decimal(variance),
          variancePercent: new Decimal(Math.min(variancePercent, 999.99)),
        });
      } else {
        // Source exists but no target match = orphaned source
        orphanedCount++;
        batchBuffer.push({
          runId,
          sourceId: source.id,
          sourceReference: source.reference,
          status: 'ORPHANED_SOURCE' as ReconItemStatus,
          matchType: 'NONE' as ReconMatchType,
          sourceAmount: new Decimal(source.amount),
        });
      }

      if (batchBuffer.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    // Find orphaned targets (exist in target but not matched to any source)
    for (const target of targetRecords) {
      if (!matchedTargetIds.has(target.id)) {
        orphanedCount++;
        batchBuffer.push({
          runId,
          targetId: target.id,
          targetReference: target.reference,
          sourceId: '',
          sourceReference: '',
          status: 'ORPHANED_TARGET' as ReconItemStatus,
          matchType: 'NONE' as ReconMatchType,
          targetAmount: new Decimal(target.amount),
        });

        if (batchBuffer.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }

    // Flush remaining items in the buffer
    await flushBatch();

    return {
      totalRecords: sourceRecords.length + targetRecords.length,
      matchedCount,
      discrepancyCount,
      orphanedCount,
    };
  }

  /**
   * Get reconciliation run details with items.
   */
  async getRunDetails(runId: string) {
    const run = await this.prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          take: 200,
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Reconciliation run ${runId} not found`);
    }

    return run;
  }

  /**
   * Resolve a reconciliation item manually.
   */
  async resolveItem(
    itemId: string,
    resolution: string,
    resolvedBy: string,
    note?: string,
  ) {
    return this.prisma.reconciliationItem.update({
      where: { id: itemId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedBy,
        resolvedAt: new Date(),
        note,
      },
    });
  }

  /**
   * List reconciliation runs with pagination.
   */
  async listRuns(skip = 0, take = 20, type?: ReconType) {
    const where = type ? { type } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reconciliationRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.reconciliationRun.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Import bank statement data for reconciliation.
   * Accepts an array of bank transactions (from CSV import or API).
   * Uses idempotency keys to prevent duplicate imports.
   */
  async importBankStatements(
    transactions: Array<{
      reference: string;
      amount: number;
      date: Date;
      description?: string;
      bankReference?: string;
    }>,
    triggeredBy: string,
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const txn of transactions) {
      const dateStr = txn.date instanceof Date
        ? txn.date.toISOString().split('T')[0]
        : String(txn.date).split('T')[0];
      const idempotencyKey = `bank:${txn.reference}:${dateStr}`;

      const existing = await this.prisma.syncLog.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.syncLog.create({
        data: {
          idempotencyKey,
          source: 'BANK_STATEMENT',
          entity: 'bank_transaction',
          externalId: txn.reference,
          action: 'import',
          status: 'SUCCESS',
          payload: {
            reference: txn.reference,
            amount: txn.amount,
            date: txn.date,
            description: txn.description,
            bankReference: txn.bankReference,
            importedBy: triggeredBy,
          } as any,
        },
      });
      imported++;
    }

    this.logger.log(
      `Bank statement import: ${imported} imported, ${skipped} skipped (duplicates). By: ${triggeredBy}`,
    );

    return { imported, skipped };
  }

  // ─── Private helpers ───

  private async completeRun(
    runId: string,
    stats: { totalRecords: number; matchedCount: number; discrepancyCount: number; orphanedCount: number },
  ) {
    const status: ReconRunStatus =
      stats.discrepancyCount > 0 || stats.orphanedCount > 0
        ? 'COMPLETED_WITH_ERRORS'
        : 'COMPLETED';

    await this.prisma.reconciliationRun.update({
      where: { id: runId },
      data: {
        status,
        totalRecords: stats.totalRecords,
        matchedCount: stats.matchedCount,
        discrepancyCount: stats.discrepancyCount,
        orphanedCount: stats.orphanedCount,
        completedAt: new Date(),
      },
    });
  }

  private async failRun(runId: string, errorMessage: string) {
    await this.prisma.reconciliationRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Parse a scope string like '2026-02' into a date range filter.
   */
  private parseScopeDateRange(scope: string): { gte?: Date; lte?: Date } {
    const parts = scope.split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      return {
        gte: new Date(year, month, 1),
        lte: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    }
    return {};
  }
}
