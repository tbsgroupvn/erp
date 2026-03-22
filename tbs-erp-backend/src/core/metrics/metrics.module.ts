import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { JobMetricsService } from './job-metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, JobMetricsService],
  exports: [MetricsService, JobMetricsService],
})
export class MetricsModule {}
