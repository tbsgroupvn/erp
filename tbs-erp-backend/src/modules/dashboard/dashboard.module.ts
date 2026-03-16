import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceReadService } from './finance-read.service';
import { SalesDashboardService } from './sales-dashboard.service';
import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';
import { MetricSnapshotService } from './metric-snapshot.service';
import { OrderModule } from '../order/order.module';

@Module({
  // ScheduleModule.forRoot() da duoc dang ky global o AppModule.
  // @Cron() decorator tren MetricSnapshotService se tu dong duoc ScheduleExplorer
  // phat hien vi AppModule dang ky truoc.
  imports: [OrderModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    FinanceReadService,
    SalesDashboardService,
    AnalyticsService,
    ReportsService,
    MetricSnapshotService,
  ],
  exports: [
    DashboardService,
    FinanceReadService,
    SalesDashboardService,
    AnalyticsService,
    ReportsService,
    MetricSnapshotService,
  ],
})
export class DashboardModule {}
