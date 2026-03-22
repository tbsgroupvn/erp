import { Injectable, Logger } from '@nestjs/common';

interface QueueMetrics {
  processed: number;
  failed: number;
  durations: number[];
}

@Injectable()
export class JobMetricsService {
  private readonly logger = new Logger(JobMetricsService.name);
  private readonly metrics = new Map<string, QueueMetrics>();

  private getOrCreate(queue: string): QueueMetrics {
    let m = this.metrics.get(queue);
    if (!m) {
      m = { processed: 0, failed: 0, durations: [] };
      this.metrics.set(queue, m);
    }
    return m;
  }

  recordCompletion(queue: string, durationMs: number): void {
    const m = this.getOrCreate(queue);
    m.processed++;
    m.durations.push(durationMs);
    // Keep last 1000 durations for percentile calculation
    if (m.durations.length > 1000) {
      m.durations.shift();
    }
  }

  recordFailure(queue: string): void {
    const m = this.getOrCreate(queue);
    m.failed++;
  }

  getMetrics(): Record<
    string,
    { processed: number; failed: number; avgDurationMs: number; p95DurationMs: number }
  > {
    const result: Record<
      string,
      { processed: number; failed: number; avgDurationMs: number; p95DurationMs: number }
    > = {};
    for (const [queue, m] of this.metrics) {
      const sorted = [...m.durations].sort((a, b) => a - b);
      const avg =
        sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
      const p95 =
        sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
      result[queue] = {
        processed: m.processed,
        failed: m.failed,
        avgDurationMs: Math.round(avg),
        p95DurationMs: Math.round(p95),
      };
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}
