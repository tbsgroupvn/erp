import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => {
  const host = process.env.REDIS_HOST || 'localhost';
  if (host === 'localhost' && process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_HOST must be configured in production');
  }
  return {
    host,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };
});
