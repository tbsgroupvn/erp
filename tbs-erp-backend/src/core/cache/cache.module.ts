import { Global, Logger, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CacheWarmingService } from './cache-warming.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { redisStore } from 'cache-manager-redis-yet';
import type { RedisClientOptions } from 'redis';

/** Cache key prefix to prevent collisions in shared Redis instances. */
export const CACHE_KEY_PREFIX = 'tbs-erp:';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        // Try to connect to Redis, fallback to in-memory if unavailable
        try {
          return {
            store: await redisStore({
              socket: {
                host: redisHost,
                port: redisPort,
              },
              password: redisPassword,
              ttl: 60 * 5 * 1000, // 5 minutes default TTL (in milliseconds)
              keyPrefix: CACHE_KEY_PREFIX,
            }),
            isGlobal: true,
          };
        } catch (error) {
          new Logger('CacheModule').warn('Redis connection failed, using in-memory cache fallback');
          // Fallback to in-memory cache
          return {
            ttl: 60 * 5 * 1000, // 5 minutes (in milliseconds for memory store)
            max: 500,
            isGlobal: true,
          };
        }
      },
    }),
  ],
  providers: [CacheService, CacheWarmingService, CacheInvalidationService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
