import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '@common/decorators/public.decorator';
import { MetricsService } from './metrics.service';
import { JobMetricsService } from './job-metrics.service';

/**
 * Prometheus metrics endpoint.
 * This controller is intentionally NOT protected by JWT auth
 * since it is consumed by Prometheus scraper on the internal network.
 * Access is restricted at the Nginx level (not exposed publicly).
 */
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly jobMetricsService: JobMetricsService,
  ) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(metrics);
  }

  @Get('jobs')
  getJobMetrics() {
    return this.jobMetricsService.getMetrics();
  }
}
