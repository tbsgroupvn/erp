import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '@core/metrics/metrics.service';

/**
 * Performance interceptor that:
 * 1. Measures request duration with high-resolution timing
 * 2. Logs slow requests (>1000ms) as warnings
 * 3. Records duration to Prometheus histogram
 * 4. Adds Server-Timing header for browser DevTools visibility
 * 5. Tracks request size metrics
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  /** Threshold in milliseconds above which requests are logged as slow */
  private readonly SLOW_REQUEST_THRESHOLD_MS = 1000;

  /** Threshold in milliseconds for critically slow requests */
  private readonly CRITICAL_THRESHOLD_MS = 5000;

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip HTTP performance tracking for non-HTTP contexts (e.g. GraphQL)
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const { url } = request;

    // Skip health and metrics endpoints to avoid noise
    const path = url.split('?')[0];
    if (path === '/api/v1/health' || path === '/api/v1/metrics') {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordPerformance(request, response, start);
        },
        error: () => {
          this.recordPerformance(request, response, start);
        },
      }),
    );
  }

  private recordPerformance(request: Request, response: Response, start: bigint): void {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1e6;
    const { method, url, ip } = request;
    const path = url.split('?')[0];

    // Add Server-Timing header for browser DevTools
    // This appears in the Network tab's Timing section
    if (!response.headersSent) {
      const timingParts: string[] = [`total;dur=${durationMs.toFixed(1)};desc="Server Total"`];

      response.setHeader('Server-Timing', timingParts.join(', '));
    }

    // Log slow requests
    if (durationMs > this.CRITICAL_THRESHOLD_MS) {
      this.logger.error(
        `CRITICAL slow request: ${method} ${path} took ${durationMs.toFixed(0)}ms ` +
          `[status=${response.statusCode}, ip=${ip}]`,
      );
    } else if (durationMs > this.SLOW_REQUEST_THRESHOLD_MS) {
      this.logger.warn(
        `Slow request: ${method} ${path} took ${durationMs.toFixed(0)}ms ` +
          `[status=${response.statusCode}, ip=${ip}]`,
      );
    }

    // Record to Prometheus slow request counter
    if (durationMs > this.SLOW_REQUEST_THRESHOLD_MS) {
      this.metricsService.slowRequestsTotal.inc({
        method,
        route: this.normalizeRoute(path),
      });
    }

    // Record response size if available
    const contentLength = response.getHeader('content-length');
    if (contentLength) {
      this.metricsService.responseSize.observe(
        { method, route: this.normalizeRoute(path) },
        Number(contentLength),
      );
    }
  }

  /**
   * Normalize a URL path to a route pattern to prevent high-cardinality
   * label values in Prometheus.
   */
  private normalizeRoute(url: string): string {
    return url
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id');
  }
}
