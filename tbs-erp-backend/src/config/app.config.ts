import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT || '3000', 10),
  env: process.env.APP_ENV || 'development',
  name: process.env.APP_NAME || 'ERP',
  corsOrigins: process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [],
}));
