import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '@common/decorators/public.decorator';
import { PrismaService } from '@core/database/prisma.service';
import { MemoryHealthIndicator } from './memory-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly diskHealth: DiskHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Memory and event loop health check
      () => this.memoryHealth.isHealthy('memory'),
      // Redis/cache health check
      () => this.redisHealth.isHealthy('redis'),
      // Disk space health check (warn at 90% usage)
      () =>
        this.diskHealth.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9,
        }),
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
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed system health with metrics' })
  async getDetailedHealth() {
    const memUsage = process.memoryUsage();

    // Run health indicators in parallel for a combined report
    let dbStatus = 'unknown';
    let redisStatus = 'unknown';

    try {
      await this.prismaHealth.pingCheck('database', this.prisma);
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    try {
      await this.redisHealth.isHealthy('redis');
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }

    return {
      status: dbStatus === 'up' && redisStatus === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
      },
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
