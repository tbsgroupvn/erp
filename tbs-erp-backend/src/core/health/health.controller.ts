import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '@core/database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }
}
