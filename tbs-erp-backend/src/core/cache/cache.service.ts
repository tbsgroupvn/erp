import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Get a value from the cache with typed return.
   *
   * @param key The cache key
   * @returns The cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value ?? undefined;
    } catch (error) {
      this.logger.warn(`Cache GET failed for key "${key}": ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set a value in the cache.
   *
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time-to-live in milliseconds (0 = use default)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.warn(`Cache SET failed for key "${key}": ${error.message}`);
    }
  }

  /**
   * Delete a value from the cache.
   *
   * @param key The cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${error.message}`);
    }
  }

  /**
   * Reset (flush) the entire cache.
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
    } catch (error) {
      this.logger.warn(`Cache RESET failed: ${error.message}`);
    }
  }

  /**
   * Get a cached value or compute and cache it if missing.
   *
   * @param key The cache key
   * @param factory Async function that produces the value if not cached
   * @param ttl Time-to-live in milliseconds (0 = use default)
   * @returns The cached or freshly computed value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get multiple values from cache in a single round-trip.
   * Uses Promise.all to parallelize individual GET calls, reducing overall latency
   * compared to sequential fetches.
   *
   * @param keys Array of cache keys to fetch
   * @returns Map of key to cached value (or null if not found)
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    try {
      const values = await Promise.all(
        keys.map((key) => this.cacheManager.get<T>(key)),
      );

      keys.forEach((key, index) => {
        result.set(key, values[index] ?? null);
      });
    } catch (error) {
      this.logger.warn(`Cache getMany error: ${error.message}`);
      keys.forEach((key) => result.set(key, null));
    }

    return result;
  }

  /**
   * Set multiple values in cache in parallel.
   * Uses Promise.all to send all SET operations concurrently.
   *
   * @param entries Array of { key, value, ttl? } objects to cache
   */
  async setMany<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void> {
    try {
      await Promise.all(
        entries.map(({ key, value, ttl }) =>
          this.cacheManager.set(key, value, ttl ?? 3600000),
        ),
      );
    } catch (error) {
      this.logger.warn(`Cache setMany error: ${error.message}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern prefix.
   * Useful for invalidating related cache entries.
   *
   * Note: This iterates over known keys. For large-scale pattern-based
   * invalidation, use Redis SCAN commands directly.
   *
   * @param prefix The key prefix to match
   */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;
      if (typeof store?.keys === 'function') {
        const keys: string[] = await store.keys(`${prefix}*`);
        await Promise.all(keys.map((key) => this.cacheManager.del(key)));
        this.logger.debug(
          `Deleted ${keys.length} cache keys with prefix "${prefix}"`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Cache DEL by prefix "${prefix}" failed: ${error.message}`,
      );
    }
  }

  /**
   * Alias for `del` - invalidate a single cache key.
   * @param key The cache key to invalidate
   */
  async invalidate(key: string): Promise<void> {
    return this.del(key);
  }

  /**
   * Alias for `delByPrefix` - invalidate all cache keys matching a prefix.
   * @param prefix The key prefix to match
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    return this.delByPrefix(prefix);
  }
}
