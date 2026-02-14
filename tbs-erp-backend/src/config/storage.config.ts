import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => {
  const storagePath = process.env.STORAGE_PATH || './uploads';
  if (storagePath === './uploads' && process.env.NODE_ENV === 'production') {
    throw new Error('STORAGE_PATH must be configured as an absolute path in production');
  }
  return {
    type: process.env.STORAGE_TYPE || 'local',
    path: storagePath,
  };
});
