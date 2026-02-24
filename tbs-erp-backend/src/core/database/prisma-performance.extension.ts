import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MetricsService } from '@core/metrics/metrics.service';

const logger = new Logger('PrismaPerformance');

/** Threshold in milliseconds above which queries are logged as slow */
const SLOW_QUERY_THRESHOLD_MS = 200;

/** Threshold for critically slow queries */
const CRITICAL_QUERY_THRESHOLD_MS = 2000;

/**
 * Prisma client extension that instruments all database queries with:
 * - High-resolution timing
 * - Prometheus histogram recording (model + operation labels)
 * - Slow query warnings with contextual information
 * - Critical query error logging
 *
 * Usage:
 *   const prisma = new PrismaClient().$extends(
 *     createPerformanceExtension(metricsService)
 *   );
 *
 * Note: This extension wraps $allOperations on $allModels, so it captures
 * findMany, create, update, delete, aggregate, groupBy, count, etc.
 */
export function createPerformanceExtension(metricsService: MetricsService) {
  return Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = performance.now();

          try {
            const result = await query(args);
            const duration = performance.now() - start;

            // Record to Prometheus histogram
            metricsService.databaseQueryDuration.observe(
              { model: model ?? 'unknown', operation },
              duration / 1000, // Convert to seconds for Prometheus
            );

            // Log slow queries
            if (duration > CRITICAL_QUERY_THRESHOLD_MS) {
              logger.error(
                `CRITICAL slow query: ${model}.${operation} took ${duration.toFixed(0)}ms` +
                  ` | args: ${summarizeArgs(args)}`,
              );
            } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
              logger.warn(
                `Slow query: ${model}.${operation} took ${duration.toFixed(0)}ms` +
                  ` | args: ${summarizeArgs(args)}`,
              );
            }

            return result;
          } catch (error) {
            const duration = performance.now() - start;

            // Record failed queries too
            metricsService.databaseQueryDuration.observe(
              { model: model ?? 'unknown', operation },
              duration / 1000,
            );

            logger.error(
              `Query error: ${model}.${operation} failed after ${duration.toFixed(0)}ms` +
                ` | error: ${error.message}`,
            );

            throw error;
          }
        },
      },
    },
  });
}

/**
 * Summarize query args for logging without exposing sensitive data.
 * Truncates large argument objects to prevent log bloat.
 */
function summarizeArgs(args: unknown): string {
  try {
    const str = JSON.stringify(args, (key, value) => {
      // Redact potentially sensitive fields
      if (['password', 'token', 'secret', 'accessToken', 'refreshToken'].includes(key)) {
        return '[REDACTED]';
      }
      return value;
    });

    // Truncate if too long
    if (str.length > 500) {
      return str.substring(0, 500) + '... (truncated)';
    }
    return str;
  } catch {
    return '[unable to serialize]';
  }
}
