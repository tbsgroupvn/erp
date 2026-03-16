import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BatchJobStatus } from '@prisma/client';

type JobHandler = (
  job: { id: string; parameters: any; lastCheckpoint: string | null },
  onProgress: (processed: number, failed: number, checkpoint?: string) => Promise<void>,
) => Promise<{ resultUrl?: string; errorSummary?: string }>;

/**
 * Batch Job Processing Pipeline.
 *
 * Handles long-running operations (reconciliation, import, export, sync)
 * with progress tracking, checkpoint/resume, and cancellation support.
 *
 * API returns 202 Accepted + jobId. Client polls GET /batch-jobs/:id for progress.
 */
@Injectable()
export class BatchJobService {
  private readonly logger = new Logger(BatchJobService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly activeJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register a handler for a specific job type.
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger.log(`Batch job handler registered: ${type}`);
  }

  /**
   * Create a new batch job and queue it for processing.
   */
  async createJob(
    type: string,
    parameters: Record<string, any>,
    createdBy: string,
  ): Promise<string> {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for batch job type: ${type}`);
    }

    const job = await this.prisma.batchJob.create({
      data: {
        type,
        status: 'QUEUED',
        parameters: parameters as any,
        createdBy,
      },
    });

    this.logger.log(`Batch job created: ${job.id} (type=${type}, by=${createdBy})`);

    // Start processing async (non-blocking)
    this.processJob(job.id).catch((err) =>
      this.logger.error(`Failed to start batch job ${job.id}: ${err.message}`),
    );

    return job.id;
  }

  /**
   * Get job status and progress.
   */
  async getJobStatus(jobId: string) {
    const job = await this.prisma.batchJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Batch job ${jobId} not found`);
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.totalRecords > 0
        ? Math.round((job.processedRecords / job.totalRecords) * 100)
        : 0,
      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      failedRecords: job.failedRecords,
      resultUrl: job.resultUrl,
      errorSummary: job.errorSummary,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }

  /**
   * Cancel a running or queued job.
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.prisma.batchJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Batch job ${jobId} not found`);
    }

    if (!['QUEUED', 'PROCESSING'].includes(job.status)) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    this.activeJobs.delete(jobId);

    await this.prisma.batchJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Batch job ${jobId} cancelled`);
  }

  /**
   * List batch jobs with pagination.
   */
  async listJobs(skip = 0, take = 20, status?: BatchJobStatus) {
    const where = status ? { status } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.batchJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.batchJob.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Process a single batch job.
   */
  private async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.batchJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'QUEUED') return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.prisma.batchJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorSummary: `No handler for type: ${job.type}`,
          completedAt: new Date(),
        },
      });
      return;
    }

    // Mark as processing
    await this.prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    this.activeJobs.add(jobId);

    try {
      const onProgress = async (processed: number, failed: number, checkpoint?: string) => {
        // Check if job was cancelled
        if (!this.activeJobs.has(jobId)) {
          throw new Error('Job cancelled');
        }

        await this.prisma.batchJob.update({
          where: { id: jobId },
          data: {
            processedRecords: processed,
            failedRecords: failed,
            lastCheckpoint: checkpoint ?? undefined,
          },
        });
      };

      const result = await handler(
        {
          id: jobId,
          parameters: job.parameters,
          lastCheckpoint: job.lastCheckpoint,
        },
        onProgress,
      );

      await this.prisma.batchJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          resultUrl: result.resultUrl,
          errorSummary: result.errorSummary,
          completedAt: new Date(),
        },
      });

      this.eventEmitter.emit('batch.job.completed', { jobId, type: job.type });
      this.logger.log(`Batch job ${jobId} completed`);
    } catch (error) {
      if (error.message === 'Job cancelled') return;

      await this.prisma.batchJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorSummary: error.message,
          completedAt: new Date(),
        },
      });

      this.logger.error(`Batch job ${jobId} failed: ${error.message}`);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Restart stale jobs that were interrupted (e.g., by process restart).
   * Picks up PROCESSING jobs that have been stuck for more than 10 minutes.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async restartStaleJobs(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);

    const staleJobs = await this.prisma.batchJob.findMany({
      where: {
        status: 'PROCESSING',
        startedAt: { lt: staleThreshold },
      },
      take: 5,
    });

    for (const job of staleJobs) {
      if (this.activeJobs.has(job.id)) continue; // Still running in this process

      this.logger.warn(`Restarting stale batch job ${job.id} (type=${job.type})`);

      // Reset to QUEUED so it gets picked up again
      await this.prisma.batchJob.update({
        where: { id: job.id },
        data: { status: 'QUEUED' },
      });

      this.processJob(job.id).catch((err) =>
        this.logger.error(`Failed to restart stale job ${job.id}: ${err.message}`),
      );
    }
  }
}
