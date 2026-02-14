import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
  }
  return { url };
});
