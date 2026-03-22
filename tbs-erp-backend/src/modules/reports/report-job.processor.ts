import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { ReportJobPayload, ReportJobType } from './report-job.types';

@Processor('report-jobs')
export class ReportJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<ReportJobPayload>): Promise<void> {
    const { reportType, date } = job.data;
    this.logger.log(`Processing report: ${reportType} for ${date}`);

    const startTime = Date.now();

    switch (reportType) {
      case ReportJobType.DAILY_REVENUE:
        await this.generateDailyRevenue(job);
        break;
      case ReportJobType.DAILY_CONTAINER_TRACKING:
        await this.generateContainerTracking(job);
        break;
      case ReportJobType.WEEKLY_AR_AGING:
        await this.generateWeeklyARAging(job);
        break;
      case ReportJobType.MONTHLY_COMMISSION:
        await this.generateMonthlyCommission(job);
        break;
      default:
        this.logger.warn(`Unknown report type: ${reportType}`);
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(`Report ${reportType} for ${date} completed in ${durationMs}ms`);
  }

  private async generateDailyRevenue(job: Job<ReportJobPayload>): Promise<void> {
    const { date } = job.data;
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Aggregate revenue by service type and branch
    const revenue = await this.prisma.order.groupBy({
      by: ['serviceType', 'branch'],
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
      _count: { id: true },
      _sum: { totalAmount: true, depositPaid: true },
    });

    // Total summary
    const totals = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
      _count: { id: true },
      _sum: { totalAmount: true, depositPaid: true },
    });

    const reportData = {
      date,
      breakdown: revenue.map((r) => ({
        serviceType: r.serviceType,
        branch: r.branch,
        orderCount: r._count.id,
        totalRevenue: r._sum.totalAmount?.toString() ?? '0',
        totalDeposits: r._sum.depositPaid?.toString() ?? '0',
      })),
      totals: {
        orderCount: totals._count.id,
        totalRevenue: totals._sum.totalAmount?.toString() ?? '0',
        totalDeposits: totals._sum.depositPaid?.toString() ?? '0',
      },
    };

    // Persist report
    await this.prisma.generatedReport.create({
      data: {
        type: ReportJobType.DAILY_REVENUE,
        date: startOfDay,
        data: reportData,
        generatedAt: new Date(),
      },
    });

    // Notify BOD - sendToRole sends to all active users of each role
    const notifyRoles = ['CEO', 'COO', 'CFO', 'SALES_DIRECTOR'];
    const notification = {
      title: `Bao cao doanh thu ${date}`,
      body: `Tong: ${totals._count.id} don, doanh thu ${totals._sum.totalAmount?.toString() ?? '0'} VND`,
      type: 'SYSTEM' as const,
      referenceId: `daily-revenue-${date}`,
    };

    await Promise.all(
      notifyRoles.map((role) => this.notificationService.sendToRole(role, notification)),
    );
  }

  private async generateContainerTracking(job: Job<ReportJobPayload>): Promise<void> {
    const { date } = job.data;

    // Get container status summary
    const statusSummary = await this.prisma.container.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Containers in transit (most important for tracking)
    const inTransit = await this.prisma.container.findMany({
      where: { status: { in: ['IN_TRANSIT', 'ARRIVED', 'CUSTOMS'] } },
      select: {
        id: true,
        code: true,
        status: true,
        shippingRoute: true,
        estimatedArrivalAt: true,
        _count: { select: { packages: true } },
      },
      orderBy: { estimatedArrivalAt: 'asc' },
      take: 100,
    });

    const reportData = {
      date,
      statusSummary: statusSummary.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      activeContainers: inTransit.map((c) => ({
        code: c.code,
        status: c.status,
        route: c.shippingRoute,
        eta: c.estimatedArrivalAt?.toISOString() ?? null,
        packageCount: c._count.packages,
      })),
    };

    await this.prisma.generatedReport.create({
      data: {
        type: ReportJobType.DAILY_CONTAINER_TRACKING,
        date: new Date(`${date}T00:00:00.000Z`),
        data: reportData,
        generatedAt: new Date(),
      },
    });

    const notifyRoles = ['COO', 'LOGISTICS_MANAGER', 'XNK_MANAGER'];
    const notification = {
      title: `Bao cao container ${date}`,
      body: `${inTransit.length} container dang van chuyen/cho thong quan`,
      type: 'SYSTEM' as const,
      referenceId: `container-tracking-${date}`,
    };

    await Promise.all(
      notifyRoles.map((role) => this.notificationService.sendToRole(role, notification)),
    );
  }

  private async generateWeeklyARAging(job: Job<ReportJobPayload>): Promise<void> {
    const { date } = job.data;

    // AR aging buckets
    const now = new Date();
    const aging = await this.prisma.accountReceivable.groupBy({
      by: ['status'],
      where: { status: { not: 'PAID' } },
      _count: { id: true },
      _sum: { amount: true, paidAmount: true },
    });

    const reportData = {
      date,
      aging: aging.map((a) => ({
        status: a.status,
        count: a._count.id,
        totalAmount: a._sum.amount?.toString() ?? '0',
        totalPaid: a._sum.paidAmount?.toString() ?? '0',
      })),
      generatedAt: now.toISOString(),
    };

    await this.prisma.generatedReport.create({
      data: {
        type: ReportJobType.WEEKLY_AR_AGING,
        date: new Date(`${date}T00:00:00.000Z`),
        data: reportData,
        generatedAt: now,
      },
    });

    const totalCount = aging.reduce((s, a) => s + a._count.id, 0);
    const notifyRoles = ['CFO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT_AR'];
    const notification = {
      title: `Bao cao cong no tuan ${date}`,
      body: `Tong ${totalCount} khoan cong no chua thu`,
      type: 'SYSTEM' as const,
      referenceId: `ar-aging-${date}`,
    };

    await Promise.all(
      notifyRoles.map((role) => this.notificationService.sendToRole(role, notification)),
    );
  }

  private async generateMonthlyCommission(job: Job<ReportJobPayload>): Promise<void> {
    const { date } = job.data;
    // Placeholder -- commission report logic
    this.logger.log(`Monthly commission report for ${date} -- not yet implemented`);
  }
}
