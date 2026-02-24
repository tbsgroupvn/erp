import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Cache } from 'cache-manager';

/**
 * Redis health indicator that checks cache connectivity
 * by performing a set/get/delete cycle.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const testKey = `health:${Date.now()}`;
      await this.cacheManager.set(testKey, 'ok', 5000);
      const value = await this.cacheManager.get(testKey);
      await this.cacheManager.del(testKey);

      const isHealthy = value === 'ok';
      const result = this.getStatus(key, isHealthy, {
        status: isHealthy ? 'connected' : 'degraded',
      });

      if (!isHealthy) {
        throw new HealthCheckError('Redis check failed', result);
      }

      return result;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        status: 'disconnected',
        message: 'Cache connectivity check failed',
      });
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
