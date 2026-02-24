import { Module } from '@nestjs/common';
import { DatabaseMonitorService } from './db-monitor.service';

/**
 * Database Monitor Module — Registers the DatabaseMonitorService which
 * performs periodic health checks on the PostgreSQL connection pool,
 * slow queries, database size, table bloat, and replication status.
 *
 * Requires:
 *   - ScheduleModule (already registered in AppModule)
 *   - PrismaService (global via DatabaseModule)
 *   - MetricsService (global via MetricsModule)
 */
@Module({
  providers: [DatabaseMonitorService],
  exports: [DatabaseMonitorService],
})
export class DatabaseMonitorModule {}
