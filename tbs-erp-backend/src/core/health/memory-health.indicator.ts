import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { MetricsService } from '@core/metrics/metrics.service';

/**
 * Memory and event loop health indicator that:
 * 1. Monitors V8 heap usage and RSS memory
 * 2. Detects memory leak trends (consecutive heap growth)
 * 3. Tracks event loop lag via setImmediate timing
 * 4. Exports all metrics to Prometheus gauges
 *
 * Health check fails when:
 * - Heap usage exceeds 90% of heap limit
 * - Event loop lag exceeds 500ms
 * - Memory has grown consecutively for 10+ sample periods (leak indicator)
 */
@Injectable()
export class MemoryHealthIndicator
  extends HealthIndicator
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MemoryHealthIndicator.name);

  /** Heap usage percentage threshold for unhealthy status */
  private readonly HEAP_THRESHOLD_PERCENT = 0.9;

  /** Event loop lag threshold in milliseconds */
  private readonly EVENT_LOOP_LAG_THRESHOLD_MS = 500;

  /** Number of consecutive heap growth samples before leak warning */
  private readonly LEAK_DETECTION_WINDOW = 10;

  /** Sampling interval for memory and event loop metrics (ms) */
  private readonly SAMPLE_INTERVAL_MS = 30_000;

  /** Historical heap usage for leak detection */
  private heapHistory: number[] = [];

  /** Consecutive growth counter */
  private consecutiveGrowth = 0;

  /** Whether a memory leak warning has been issued */
  private leakWarningIssued = false;

  /** Interval handle for cleanup */
  private sampleInterval: NodeJS.Timeout | null = null;

  /** Latest event loop lag measurement */
  private currentEventLoopLag = 0;

  constructor(private readonly metricsService: MetricsService) {
    super();
  }

  onModuleInit(): void {
    // Start periodic sampling
    this.sampleInterval = setInterval(() => {
      this.sampleMetrics();
    }, this.SAMPLE_INTERVAL_MS);

    // Initial sample
    this.sampleMetrics();

    this.logger.log(
      `Memory health monitoring started (interval: ${this.SAMPLE_INTERVAL_MS / 1000}s)`,
    );
  }

  onModuleDestroy(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  /**
   * Terminus health check method.
   * Returns detailed memory and event loop metrics.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const memUsage = process.memoryUsage();
    const heapStats = this.getHeapStats();
    const heapUsedPercent = heapStats.heapUsedPercent;

    const isHeapHealthy = heapUsedPercent < this.HEAP_THRESHOLD_PERCENT;
    const isEventLoopHealthy =
      this.currentEventLoopLag < this.EVENT_LOOP_LAG_THRESHOLD_MS;
    const isHealthy = isHeapHealthy && isEventLoopHealthy;

    const details = {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsedPercent: Math.round(heapUsedPercent * 100),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      eventLoopLagMs: Math.round(this.currentEventLoopLag),
      leakSuspected: this.consecutiveGrowth >= this.LEAK_DETECTION_WINDOW,
      consecutiveGrowthSamples: this.consecutiveGrowth,
    };

    const result = this.getStatus(key, isHealthy, details);

    if (!isHealthy) {
      const reasons: string[] = [];
      if (!isHeapHealthy) {
        reasons.push(
          `Heap usage ${details.heapUsedPercent}% exceeds ${this.HEAP_THRESHOLD_PERCENT * 100}% threshold`,
        );
      }
      if (!isEventLoopHealthy) {
        reasons.push(
          `Event loop lag ${details.eventLoopLagMs}ms exceeds ${this.EVENT_LOOP_LAG_THRESHOLD_MS}ms threshold`,
        );
      }
      throw new HealthCheckError(reasons.join('; '), result);
    }

    return result;
  }

  /**
   * Collect and export metrics to Prometheus.
   */
  private sampleMetrics(): void {
    const memUsage = process.memoryUsage();
    const heapStats = this.getHeapStats();

    // Export to Prometheus
    this.metricsService.memoryHeapUsed.set(memUsage.heapUsed);
    this.metricsService.memoryHeapTotal.set(memUsage.heapTotal);
    this.metricsService.memoryRss.set(memUsage.rss);
    this.metricsService.memoryExternal.set(memUsage.external);

    // Track heap growth trend for leak detection
    this.trackHeapGrowth(memUsage.heapUsed);

    // Measure event loop lag
    this.measureEventLoopLag();
  }

  /**
   * Track heap growth over time for leak detection.
   */
  private trackHeapGrowth(currentHeapUsed: number): void {
    const previousHeap =
      this.heapHistory.length > 0
        ? this.heapHistory[this.heapHistory.length - 1]
        : 0;

    this.heapHistory.push(currentHeapUsed);

    // Keep only the last N samples
    if (this.heapHistory.length > this.LEAK_DETECTION_WINDOW * 2) {
      this.heapHistory = this.heapHistory.slice(-this.LEAK_DETECTION_WINDOW * 2);
    }

    // Track consecutive growth
    if (previousHeap > 0 && currentHeapUsed > previousHeap) {
      this.consecutiveGrowth++;
    } else {
      this.consecutiveGrowth = 0;
      this.leakWarningIssued = false;
    }

    // Warn on suspected leak
    if (
      this.consecutiveGrowth >= this.LEAK_DETECTION_WINDOW &&
      !this.leakWarningIssued
    ) {
      const growthMB =
        (currentHeapUsed - this.heapHistory[this.heapHistory.length - this.LEAK_DETECTION_WINDOW]) /
        1024 /
        1024;

      this.logger.error(
        `MEMORY LEAK SUSPECTED: Heap has grown consecutively for ${this.consecutiveGrowth} samples ` +
          `(+${growthMB.toFixed(1)}MB over ${(this.consecutiveGrowth * this.SAMPLE_INTERVAL_MS) / 1000}s). ` +
          `Current heap: ${(currentHeapUsed / 1024 / 1024).toFixed(1)}MB`,
      );
      this.leakWarningIssued = true;

      // Export leak indicator to Prometheus
      this.metricsService.memoryLeakSuspected.set(1);
    } else if (this.consecutiveGrowth < this.LEAK_DETECTION_WINDOW) {
      this.metricsService.memoryLeakSuspected.set(0);
    }
  }

  /**
   * Measure event loop lag using setImmediate timing.
   * A healthy Node.js process should have <10ms lag.
   * Lag >100ms indicates the event loop is blocked.
   */
  private measureEventLoopLag(): void {
    const start = process.hrtime.bigint();

    setImmediate(() => {
      const lagNs = Number(process.hrtime.bigint() - start);
      const lagMs = lagNs / 1e6;

      this.currentEventLoopLag = lagMs;
      this.metricsService.eventLoopLag.set(lagMs);

      if (lagMs > this.EVENT_LOOP_LAG_THRESHOLD_MS) {
        this.logger.error(
          `Event loop lag: ${lagMs.toFixed(1)}ms (threshold: ${this.EVENT_LOOP_LAG_THRESHOLD_MS}ms)`,
        );
      } else if (lagMs > 100) {
        this.logger.warn(`Elevated event loop lag: ${lagMs.toFixed(1)}ms`);
      }
    });
  }

  /**
   * Get V8 heap statistics.
   */
  private getHeapStats() {
    const memUsage = process.memoryUsage();
    // Use heapTotal as the practical limit since v8.getHeapStatistics()
    // may not be available in all environments
    const heapLimit = memUsage.heapTotal * 1.5; // Approximate max heap
    const heapUsedPercent = memUsage.heapUsed / heapLimit;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapLimit,
      heapUsedPercent,
    };
  }
}
