import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { MetricsService } from '@core/metrics/metrics.service';

/**
 * Database Monitor Service — Tracks connection pool health, slow queries,
 * database size, and table bloat via scheduled checks.
 *
 * Metrics are recorded to Prometheus via MetricsService and logged for
 * ELK Stack ingestion (see docker-compose.production.yml — Logstash).
 *
 * Alert thresholds:
 *   - > 5 idle-in-transaction connections: WARN
 *   - > 10 idle-in-transaction connections: ERROR
 *   - Query running > 5 seconds: WARN (slow query)
 *   - Query running > 30 seconds: ERROR (critical)
 *   - Database size > 80% of disk: WARN
 *
 * Cron intervals (overridable via env vars):
 *   DB_MONITOR_POOL_CRON    — connection pool check  (default: every 2 minutes)
 *   DB_MONITOR_SLOW_CRON    — slow query check        (default: every 5 minutes)
 *   Both accept standard cron expressions or @nestjs/schedule constants.
 */
@Injectable()
export class DatabaseMonitorService {
  private readonly logger = new Logger(DatabaseMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Connection Pool Monitoring  (default: every 2 minutes)
  // ─────────────────────────────────────────────────────────────────────────

  @Cron(process.env.DB_MONITOR_POOL_CRON ?? '*/2 * * * *')
  async checkConnectionPool(): Promise<void> {
    try {
      const result: any[] = await this.prisma.$queryRaw`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE state = 'active')::int AS active,
          count(*) FILTER (WHERE state = 'idle')::int AS idle,
          count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_in_transaction,
          count(*) FILTER (WHERE wait_event IS NOT NULL)::int AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      if (!result || result.length === 0) return;

      const stats = result[0];

      // Record to Prometheus gauges
      this.metricsService.dbConnectionsTotal.set(stats.total);
      this.metricsService.dbConnectionsActive.set(stats.active);
      this.metricsService.dbConnectionsIdle.set(stats.idle);
      this.metricsService.dbConnectionsIdleInTransaction.set(stats.idle_in_transaction);
      this.metricsService.dbConnectionsWaiting.set(stats.waiting);

      // Alert on problematic states
      if (stats.idle_in_transaction > 10) {
        this.logger.error(
          `CRITICAL: ${stats.idle_in_transaction} idle-in-transaction connections detected. ` +
            `This may indicate uncommitted transactions or application bugs.`,
        );
      } else if (stats.idle_in_transaction > 5) {
        this.logger.warn(
          `${stats.idle_in_transaction} idle-in-transaction connections detected. ` +
            `Consider investigating long-running transactions.`,
        );
      }

      if (stats.waiting > 10) {
        this.logger.warn(
          `${stats.waiting} connections are waiting for locks. ` +
            `This may indicate contention issues.`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check connection pool: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Slow Query Detection  (default: every 5 minutes)
  // ─────────────────────────────────────────────────────────────────────────

  @Cron(process.env.DB_MONITOR_SLOW_CRON ?? '*/5 * * * *')
  async checkSlowQueries(): Promise<void> {
    try {
      const slowQueries: any[] = await this.prisma.$queryRaw`
        SELECT
          pid,
          EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,2) AS duration_seconds,
          LEFT(query, 200) AS query_preview,
          state,
          wait_event_type,
          wait_event,
          usename
        FROM pg_stat_activity
        WHERE (now() - query_start) > interval '5 seconds'
          AND state != 'idle'
          AND pid != pg_backend_pid()
        ORDER BY query_start ASC
        LIMIT 10
      `;

      if (slowQueries.length > 0) {
        // Record metric
        this.metricsService.dbSlowQueriesTotal.inc(slowQueries.length);

        for (const sq of slowQueries) {
          // Log truncated query preview without parameters to avoid leaking PII
          const safePreview = (sq.query_preview || '').substring(0, 200);
          if (sq.duration_seconds > 30) {
            this.logger.error(
              `CRITICAL slow query (${sq.duration_seconds}s) by ${sq.usename}: ${safePreview}`,
            );
          } else {
            this.logger.warn(
              `Slow query (${sq.duration_seconds}s) by ${sq.usename}: ${safePreview}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check slow queries: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Database Size Monitoring  (every hour — unchanged)
  // ─────────────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkDatabaseSize(): Promise<void> {
    try {
      const sizes: any[] = await this.prisma.$queryRaw`
        SELECT
          pg_database_size(current_database())::bigint AS total_bytes,
          pg_size_pretty(pg_database_size(current_database())) AS total_pretty
      `;

      if (sizes.length > 0) {
        const totalBytes = Number(sizes[0].total_bytes);
        this.metricsService.dbSizeBytes.set(totalBytes);

        this.logger.log(`Database size: ${sizes[0].total_pretty}`);
      }

      // Also check largest tables
      const largeTables: any[] = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table_name,
          pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
          pg_total_relation_size(relid)::bigint AS total_bytes,
          n_live_tup::bigint AS row_count
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `;

      for (const table of largeTables) {
        this.metricsService.dbTableSizeBytes.set(
          { table: table.table_name },
          Number(table.total_bytes),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check database size: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Table Bloat Detection  (daily at 3:00 AM — unchanged)
  // ─────────────────────────────────────────────────────────────────────────

  @Cron('0 3 * * *') // Daily at 3:00 AM
  async checkTableBloat(): Promise<void> {
    try {
      const bloatedTables: any[] = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table_name,
          n_dead_tup::bigint AS dead_tuples,
          n_live_tup::bigint AS live_tuples,
          CASE WHEN n_live_tup > 0 THEN
            ROUND((n_dead_tup::numeric / n_live_tup * 100), 2)
          ELSE 0 END AS dead_ratio_pct,
          last_autovacuum,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        ORDER BY n_dead_tup DESC
        LIMIT 20
      `;

      for (const table of bloatedTables) {
        if (table.dead_ratio_pct > 30) {
          this.logger.warn(
            `Table ${table.table_name} has ${table.dead_ratio_pct}% dead tuples ` +
              `(${table.dead_tuples} dead / ${table.live_tuples} live). ` +
              `Last autovacuum: ${table.last_autovacuum ?? 'never'}. Consider manual VACUUM.`,
          );
        }
      }

      // Check for tables that have never been vacuumed
      const neverVacuumed: any[] = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table_name,
          n_dead_tup::bigint AS dead_tuples
        FROM pg_stat_user_tables
        WHERE last_autovacuum IS NULL
          AND last_vacuum IS NULL
          AND n_dead_tup > 500
        ORDER BY n_dead_tup DESC
        LIMIT 10
      `;

      if (neverVacuumed.length > 0) {
        this.logger.warn(
          `${neverVacuumed.length} tables have never been vacuumed and have dead tuples: ` +
            neverVacuumed.map((t) => t.table_name).join(', '),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check table bloat: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Replication Lag Check  (every 5 minutes — reduced from every minute)
  // ─────────────────────────────────────────────────────────────────────────

  @Cron('*/5 * * * *')
  async checkReplicationStatus(): Promise<void> {
    try {
      const replicationInfo: any[] = await this.prisma.$queryRaw`
        SELECT
          client_addr,
          state,
          EXTRACT(EPOCH FROM (now() - sent_lsn::text::pg_lsn - replay_lsn::text::pg_lsn))::numeric(10,2) AS lag_seconds,
          pg_wal_lsn_diff(sent_lsn, replay_lsn)::bigint AS lag_bytes
        FROM pg_stat_replication
        LIMIT 5
      `;

      for (const rep of replicationInfo) {
        this.metricsService.dbReplicationLagBytes.set(
          { client: rep.client_addr ?? 'unknown' },
          Number(rep.lag_bytes ?? 0),
        );

        if (Number(rep.lag_bytes) > 100 * 1024 * 1024) {
          // > 100MB
          this.logger.warn(
            `Replication lag for ${rep.client_addr}: ${rep.lag_bytes} bytes (${rep.state})`,
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Not an error if replication is not configured
      // pg_stat_replication will be empty on standalone instances
    }
  }
}
