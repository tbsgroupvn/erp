import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExportModule } from '@core/export/export.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { ReportJobProcessor } from './report-job.processor';

// NOTE: ReportsModule must be imported in app.module.ts to activate export endpoints.
// Add to app.module.ts imports array:
//   import { ReportsModule } from '@modules/reports/reports.module';
//   ReportsModule,
@Module({
  imports: [
    BullModule.registerQueue({ name: 'report-jobs' }),
    ExportModule,
    NotificationModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportSchedulerService, ReportJobProcessor],
  exports: [ReportsService, ReportSchedulerService],
})
export class ReportsModule {}
