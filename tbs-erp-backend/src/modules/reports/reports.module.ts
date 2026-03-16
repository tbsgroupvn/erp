import { Module } from '@nestjs/common';
import { ExportModule } from '@core/export/export.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// NOTE: ReportsModule must be imported in app.module.ts to activate export endpoints.
// Add to app.module.ts imports array:
//   import { ReportsModule } from '@modules/reports/reports.module';
//   ReportsModule,
@Module({
  imports: [ExportModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
