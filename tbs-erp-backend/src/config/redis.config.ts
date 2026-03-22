import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const host = process.env.REDIS_HOST || 'localhost';
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  if (host === 'localhost' && process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_HOST must be configured in production');
  }

  // MC-01: Redis password is mandatory in staging/production environments.
  // An unauthenticated Redis instance in production is a critical security risk.
  if (isProd && !process.env.REDIS_PASSWORD) {
    throw new Error(
      'REDIS_PASSWORD is required in staging/production. ' +
        'Set REDIS_PASSWORD in your environment or .env file.',
    );
  }

  return {
    host,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    // Password is optional in development, mandatory in staging/production (enforced above).
    // Used by: BullMQ connection, Redis cache, and RedisIoAdapter (WebSocket scaling).
    password: process.env.REDIS_PASSWORD || undefined,
  };
});
