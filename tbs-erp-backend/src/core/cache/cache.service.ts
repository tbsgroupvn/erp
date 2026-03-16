import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Access the underlying Redis client (if the primary store is Redis-backed).
   * Returns null when running with the in-memory fallback.
   */
  private getRedisClient(): any | null {
    try {
      const stores = (this.cacheManager as any).stores;
      if (!stores?.[0]) return null;
      // stores[0] is a Keyv instance; its .store is the KeyvRedis adapter
      const adapter = stores[0].store;
      return adapter?.client ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get the Keyv namespace prefix used for cache-manager keys.
   * Keys stored through cache-manager are prefixed with `namespace:`.
   */
  private getKeyvNamespace(): string {
    try {
      const stores = (this.cacheManager as any).stores;
      const ns = stores?.[0]?.namespace;
      return ns ? `${ns}:` : '';
    } catch {
      return '';
    }
  }

  /**
   * Get a value from the cache with typed return.
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
   * @returns true if the value was set successfully, false if cache is unavailable
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      await this.cacheManager.set(key, value, ttl);
      return true;
    } catch (error) {
      this.logger.warn(`Cache SET failed for key "${key}": ${error.message}`);
      return false;
    }
  }

  /**
   * Delete a value from the cache.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${error.message}`);
    }
  }

  /**
   * Clear (flush) the entire cache.
   * cache-manager v6 uses clear() instead of reset().
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.clear();
    } catch (error) {
      this.logger.warn(`Cache CLEAR failed: ${error.message}`);
    }
  }

  /**
   * Get a cached value or compute and cache it if missing.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
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
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    try {
      const values = await Promise.all(keys.map((key) => this.cacheManager.get<T>(key)));

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
   */
  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      await Promise.all(
        entries.map(({ key, value, ttl }) => this.cacheManager.set(key, value, ttl ?? 3600000)),
      );
    } catch (error) {
      this.logger.warn(`Cache setMany error: ${error.message}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern prefix.
   *
   * Uses the underlying Redis client KEYS command to find matching keys
   * within the Keyv namespace, then deletes them directly.
   */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const client = this.getRedisClient();
      if (client && typeof client.keys === 'function') {
        // Keys stored via cache-manager are prefixed with the Keyv namespace
        const ns = this.getKeyvNamespace();
        const pattern = `${ns}${prefix}*`;
        const keys: string[] = await client.keys(pattern);
        if (keys.length > 0) {
          // Delete directly from Redis (keys include full prefix)
          await Promise.all(keys.map((key: string) => client.del(key)));
        }
        this.logger.debug(`Deleted ${keys.length} cache keys with prefix "${prefix}"`);
      }
    } catch (error) {
      this.logger.warn(`Cache DEL by prefix "${prefix}" failed: ${error.message}`);
    }
  }

  /**
   * Atomically increment a numeric key by 1 and return the new value.
   * Creates the key with value 1 if it doesn't exist.
   * Operates on raw Redis keys (outside the Keyv namespace).
   */
  async incr(key: string): Promise<number> {
    const client = this.getRedisClient();
    if (client && typeof client.incr === 'function') {
      return client.incr(key);
    }
    // Fallback for non-Redis stores: get + set (not atomic but functional)
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next);
    return next;
  }

  /**
   * Set a TTL (in seconds) on an existing key.
   * Operates on raw Redis keys (outside the Keyv namespace).
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const client = this.getRedisClient();
      if (client && typeof client.expire === 'function') {
        await client.expire(key, ttlSeconds);
      }
    } catch (error) {
      this.logger.warn(`Cache EXPIRE failed for key "${key}": ${error.message}`);
    }
  }

  /**
   * Set a key only if it does not already exist (SETNX).
   * Returns true if the key was set, false if it already existed.
   * Operates on raw Redis keys (outside the Keyv namespace).
   */
  async setnx(key: string, value: number | string, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = this.getRedisClient();
      if (client && typeof client.set === 'function') {
        // node-redis v4/v5: use SET with NX option
        const options: any = { NX: true };
        if (ttlSeconds) {
          options.EX = ttlSeconds;
        }
        const result = await client.set(key, String(value), options);
        return result === 'OK';
      }
      // Fallback: check-then-set (not atomic)
      const existing = await this.get(key);
      if (existing !== undefined) return false;
      await this.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
      return true;
    } catch (error) {
      this.logger.warn(`Cache SETNX failed for key "${key}": ${error.message}`);
      return false;
    }
  }

  /**
   * Alias for `del` - invalidate a single cache key.
   */
  async invalidate(key: string): Promise<void> {
    return this.del(key);
  }

  /**
   * Alias for `delByPrefix` - invalidate all cache keys matching a prefix.
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    return this.delByPrefix(prefix);
  }
}
