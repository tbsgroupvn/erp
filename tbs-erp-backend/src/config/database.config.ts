import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Pool size = num_cores * 2 + disk_spindles. Default 20 for 50-70 concurrent users.
  const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '20', 10);

  return { url, poolSize };
});
