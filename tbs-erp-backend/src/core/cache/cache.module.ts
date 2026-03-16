import { Global, Logger, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CacheWarmingService } from './cache-warming.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import KeyvRedis from '@keyv/redis';
import Keyv from 'keyv';

/** Cache key prefix / Keyv namespace to prevent collisions in shared Redis instances. */
export const CACHE_KEY_PREFIX = 'tbs-erp';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        // Try to connect to Redis, fallback to in-memory if unavailable
        try {
          const redisUrl = redisPassword
            ? `redis://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}`
            : `redis://${redisHost}:${redisPort}`;

          const keyvRedis = new KeyvRedis(redisUrl);
          const keyv = new Keyv({ store: keyvRedis, namespace: CACHE_KEY_PREFIX });

          return {
            stores: [keyv],
            ttl: 60 * 5 * 1000, // 5 minutes default TTL (in milliseconds)
          };
        } catch (err) {
          new Logger('CacheModule').warn(
            `Redis connection failed (${err?.message}), using in-memory cache fallback`,
          );
          // Fallback to in-memory cache (no stores → default memory store)
          return {
            ttl: 60 * 5 * 1000,
            max: 500,
          };
        }
      },
    }),
  ],
  providers: [CacheService, CacheWarmingService, CacheInvalidationService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
