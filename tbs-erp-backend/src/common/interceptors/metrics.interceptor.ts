import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '@core/metrics/metrics.service';

/**
 * Excluded paths that should not be recorded in HTTP metrics.
 * Health and metrics endpoints generate noise and are not meaningful for monitoring.
 */
const EXCLUDED_PATHS = ['/api/v1/health', '/api/v1/metrics'];

/**
 * Normalizes a URL path to a route pattern by replacing UUIDs and numeric IDs
 * with placeholders. This prevents high-cardinality label values in Prometheus.
 *
 * Examples:
 *   /api/orders/550e8400-e29b-41d4-a716-446655440000 -> /api/orders/:id
 *   /api/employees/42 -> /api/employees/:id
 */
function normalizeRoute(url: string): string {
  const path = url.split('?')[0];
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id');
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip HTTP metrics for non-HTTP contexts (e.g. GraphQL)
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;

    // Skip excluded paths
    const path = url.split('?')[0];
    if (EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))) {
      return next.handle();
    }

    const route = normalizeRoute(url);
    const startTime = process.hrtime.bigint();

    // Increment active connections
    this.metricsService.activeConnections.inc();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = String(response.statusCode);
          this.recordMetrics(method, route, statusCode, startTime);
        },
        error: (error) => {
          const statusCode = String(error?.status || 500);
          this.recordMetrics(method, route, statusCode, startTime);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: string,
    startTime: bigint,
  ): void {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSeconds = durationNs / 1e9;

    // Record request count
    this.metricsService.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
    });

    // Record request duration
    this.metricsService.httpRequestDuration.observe({ method, route }, durationSeconds);

    // Decrement active connections
    this.metricsService.activeConnections.dec();
  }
}
