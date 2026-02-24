import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

/**
 * Represents a query execution plan from EXPLAIN ANALYZE.
 */
export interface QueryPlan {
  query: string;
  planningTime: number;
  executionTime: number;
  totalCost: number;
  rows: number;
  plan: string[];
  suggestions: string[];
}

/**
 * Represents a suggestion for a missing index.
 */
export interface IndexSuggestion {
  tableName: string;
  sequentialScans: number;
  sequentialTuplesRead: number;
  indexScans: number;
  indexTuplesFetched: number;
  averageRowsPerScan: number;
  suggestion: string;
}

/**
 * Represents an unused index that may be a candidate for removal.
 */
export interface UnusedIndex {
  tableName: string;
  indexName: string;
  indexSize: string;
  indexScans: number;
}

/**
 * Query Analyzer Service — Provides database query analysis tools for
 * development and operations.
 *
 * Features:
 *   - EXPLAIN ANALYZE wrapper for investigating query plans
 *   - Missing index detection via pg_stat_user_tables
 *   - Unused index identification
 *   - Periodic index health reporting
 *
 * Security: analyzeQuery() is only available in non-production environments
 * to prevent accidental data exposure through EXPLAIN output.
 */
@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction =
      configService.get<string>('app.env', 'development') === 'production';
  }

  /**
   * Run EXPLAIN ANALYZE on a query and return the parsed plan.
   *
   * Only available in development/staging environments to prevent
   * accidental data exposure through query plan output.
   */
  async analyzeQuery(query: string): Promise<QueryPlan> {
    if (this.isProduction) {
      throw new Error('Query analysis is not available in production environments');
    }

    try {
      const result: any[] = await this.prisma.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
      );

      const plan = result[0]?.['QUERY PLAN']?.[0] ?? {};
      const planLines: any[] = await this.prisma.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS) ${query}`,
      );

      const planText = planLines.map((row) => Object.values(row)[0] as string);
      const suggestions: string[] = [];

      // Detect sequential scans on large tables
      if (planText.some((line) => line.includes('Seq Scan'))) {
        suggestions.push(
          'Sequential scan detected. Consider adding an index on the filtered columns.',
        );
      }

      // Detect nested loops with high row counts
      if (planText.some((line) => line.includes('Nested Loop') && line.includes('rows='))) {
        suggestions.push(
          'Nested loop join detected. For large datasets, consider if a hash or merge join would be more efficient.',
        );
      }

      // Detect sort operations without index
      if (planText.some((line) => line.includes('Sort Method: external'))) {
        suggestions.push(
          'External sort detected (spilling to disk). Consider adding an index that covers the ORDER BY clause.',
        );
      }

      return {
        query,
        planningTime: plan['Planning Time'] ?? 0,
        executionTime: plan['Execution Time'] ?? 0,
        totalCost: plan.Plan?.['Total Cost'] ?? 0,
        rows: plan.Plan?.['Actual Rows'] ?? 0,
        plan: planText,
        suggestions,
      };
    } catch (error) {
      this.logger.error(`Query analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Suggest missing indexes based on pg_stat_user_tables.
   *
   * Tables with high sequential scan counts relative to index scans are
   * candidates for additional indexes.
   */
  async suggestIndexes(): Promise<IndexSuggestion[]> {
    try {
      const result: any[] = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table_name,
          seq_scan::bigint AS seq_scan,
          seq_tup_read::bigint AS seq_tup_read,
          COALESCE(idx_scan, 0)::bigint AS idx_scan,
          COALESCE(idx_tup_fetch, 0)::bigint AS idx_tup_fetch,
          CASE WHEN seq_scan > 0
            THEN (seq_tup_read / seq_scan)::bigint
            ELSE 0
          END AS avg_seq_rows
        FROM pg_stat_user_tables
        WHERE seq_scan > 100
          AND (idx_scan IS NULL OR idx_scan < seq_scan)
          AND seq_tup_read > 10000
        ORDER BY seq_tup_read DESC
        LIMIT 20
      `;

      return result.map((row) => ({
        tableName: row.table_name,
        sequentialScans: Number(row.seq_scan),
        sequentialTuplesRead: Number(row.seq_tup_read),
        indexScans: Number(row.idx_scan),
        indexTuplesFetched: Number(row.idx_tup_fetch),
        averageRowsPerScan: Number(row.avg_seq_rows),
        suggestion:
          `Table "${row.table_name}" has ${row.seq_scan} sequential scans reading ` +
          `an average of ${row.avg_seq_rows} rows each, but only ${row.idx_scan} index scans. ` +
          `Investigate WHERE/JOIN clauses on this table and add appropriate indexes.`,
      }));
    } catch (error) {
      this.logger.error(`Index suggestion query failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Identify unused indexes that consume disk space without benefit.
   *
   * These are candidates for removal, but should be verified against
   * periodic workloads (e.g., monthly reports) before dropping.
   */
  async findUnusedIndexes(): Promise<UnusedIndex[]> {
    try {
      const result: any[] = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || relname AS table_name,
          indexrelname AS index_name,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
          idx_scan::bigint AS index_scans
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
          AND indexrelname NOT LIKE '%_pkey'
          AND indexrelname NOT LIKE '%_unique%'
          AND schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `;

      return result.map((row) => ({
        tableName: row.table_name,
        indexName: row.index_name,
        indexSize: row.index_size,
        indexScans: Number(row.index_scans),
      }));
    } catch (error) {
      this.logger.error(`Unused index query failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Periodic index health report — runs weekly and logs findings.
   */
  @Cron('0 4 * * 0') // Every Sunday at 4:00 AM
  async weeklyIndexHealthReport(): Promise<void> {
    this.logger.log('Running weekly index health report...');

    const suggestions = await this.suggestIndexes();
    if (suggestions.length > 0) {
      this.logger.warn(
        `${suggestions.length} tables may benefit from additional indexes:`,
      );
      for (const s of suggestions.slice(0, 5)) {
        this.logger.warn(`  - ${s.suggestion}`);
      }
    } else {
      this.logger.log('No missing index suggestions — all tables are well-indexed.');
    }

    const unused = await this.findUnusedIndexes();
    if (unused.length > 0) {
      this.logger.log(
        `${unused.length} unused indexes found (candidates for review):`,
      );
      for (const u of unused.slice(0, 5)) {
        this.logger.log(
          `  - ${u.indexName} on ${u.tableName} (${u.indexSize}, 0 scans)`,
        );
      }
    }

    this.logger.log('Weekly index health report complete.');
  }

  /**
   * Get table statistics for a specific table. Useful for debugging
   * performance issues in specific modules.
   */
  async getTableStats(tableName: string): Promise<any> {
    const result: any[] = await this.prisma.$queryRaw`
      SELECT
        schemaname,
        relname AS table_name,
        seq_scan::bigint AS seq_scan,
        seq_tup_read::bigint AS seq_tup_read,
        idx_scan::bigint AS idx_scan,
        idx_tup_fetch::bigint AS idx_tup_fetch,
        n_tup_ins::bigint AS inserts,
        n_tup_upd::bigint AS updates,
        n_tup_del::bigint AS deletes,
        n_live_tup::bigint AS live_rows,
        n_dead_tup::bigint AS dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size
      FROM pg_stat_user_tables
      WHERE relname = ${tableName}
      LIMIT 1
    `;

    return result[0] ?? null;
  }
}
