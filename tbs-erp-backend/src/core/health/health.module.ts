import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MemoryHealthIndicator } from './memory-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

/**
 * Health module providing comprehensive health checks:
 * - Database: Prisma ping check (via HealthController)
 * - Memory & Event Loop: Heap usage, event loop lag, leak detection
 * - Redis: Cache connectivity check
 * - Disk: Disk space usage check (via Terminus DiskHealthIndicator in controller)
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MemoryHealthIndicator, RedisHealthIndicator],
  exports: [MemoryHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
