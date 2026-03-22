import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportJobType, ReportJobPayload } from './report-job.types';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    @InjectQueue('report-jobs') private readonly reportQueue: Queue,
  ) {}

  /**
   * Daily revenue report -- runs at 6:00 AM Vietnam time (23:00 UTC previous day).
   */
  @Cron('0 23 * * *', { name: 'daily-revenue-report' })
  async scheduleDailyRevenue(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    this.logger.log(`Scheduling daily revenue report for ${dateStr}`);

    await this.reportQueue.add(
      ReportJobType.DAILY_REVENUE,
      {
        reportType: ReportJobType.DAILY_REVENUE,
        date: dateStr,
        format: 'HTML',
      } satisfies ReportJobPayload,
      {
        jobId: `daily-revenue-${dateStr}`,
        attempts: 2,
        backoff: { type: 'fixed', delay: 300_000 },
      },
    );
  }

  /**
   * Daily container tracking report -- runs at 7:00 AM Vietnam time (00:00 UTC).
   */
  @Cron('0 0 * * *', { name: 'daily-container-tracking' })
  async scheduleDailyContainerTracking(): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];

    this.logger.log(`Scheduling container tracking report for ${dateStr}`);

    await this.reportQueue.add(
      ReportJobType.DAILY_CONTAINER_TRACKING,
      {
        reportType: ReportJobType.DAILY_CONTAINER_TRACKING,
        date: dateStr,
        format: 'HTML',
      } satisfies ReportJobPayload,
      {
        jobId: `container-tracking-${dateStr}`,
        attempts: 2,
        backoff: { type: 'fixed', delay: 300_000 },
      },
    );
  }

  /**
   * Weekly AR aging report -- runs every Monday at 7:00 AM Vietnam time.
   */
  @Cron('0 0 * * 1', { name: 'weekly-ar-aging-report' })
  async scheduleWeeklyARAging(): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];

    this.logger.log(`Scheduling weekly AR aging report for ${dateStr}`);

    await this.reportQueue.add(
      ReportJobType.WEEKLY_AR_AGING,
      {
        reportType: ReportJobType.WEEKLY_AR_AGING,
        date: dateStr,
        format: 'HTML',
      } satisfies ReportJobPayload,
      {
        jobId: `ar-aging-${dateStr}`,
        attempts: 2,
      },
    );
  }

  /**
   * Manual trigger via API -- allows on-demand report generation.
   */
  async triggerReport(payload: ReportJobPayload): Promise<{ jobId: string }> {
    const job = await this.reportQueue.add(payload.reportType, payload, {
      priority: 1,
    });
    return { jobId: String(job.id) };
  }
}
