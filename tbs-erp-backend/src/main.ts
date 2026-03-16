import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@common/filters/prisma-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { MetricsInterceptor } from '@common/interceptors/metrics.interceptor';
import { PerformanceInterceptor } from '@common/interceptors/performance.interceptor';
import { AuditLogInterceptor } from '@common/interceptors/audit-log.interceptor';
import { MetricsService } from '@core/metrics/metrics.service';
import { ElkLoggerService } from '@core/logger/elk-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { RedisIoAdapter } from '@core/websocket/redis-io.adapter';
import { initSentry } from '@config/sentry.config';
import * as compression from 'compression';
import { getCompressionOptions } from '@common/middleware/compression.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Serve static files (for uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Initialize Sentry (must be early, before other middleware)
  await initSentry(app);

  // Global prefix — versioned API (v1)
  // Exclude GraphQL, WebSocket, and admin (Bull Board) from API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/graphql', '/ws', '/admin/queues', '/admin/queues/(.*)'],
  });

  // Response compression (Brotli/Gzip with 1KB threshold)
  app.use(compression(getCompressionOptions()));

  // Security
  app.use(helmet());

  // Cookie parser (required for HttpOnly cookies)
  app.use(cookieParser());

  // CORS
  const corsOrigins = configService.get<string[]>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true, // Required for cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24h preflight cache
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // Global interceptors (MetricsInterceptor, PerformanceInterceptor, AuditLogInterceptor require DI)
  const metricsService = app.get(MetricsService);
  const prismaService = app.get(PrismaService);
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
    new MetricsInterceptor(metricsService),
    new PerformanceInterceptor(metricsService),
    new AuditLogInterceptor(prismaService),
  );

  // Use structured ELK logger if enabled (falls back to console internally)
  const elkLogger = app.get(ElkLoggerService);
  app.useLogger(elkLogger);

  // Swagger
  const appTitle = configService.get<string>('branding.appTitle') || 'ERP System';
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appTitle} API`)
    .setDescription(
      `
## ${appTitle} API

### Authentication
All endpoints require Bearer token authentication unless marked as public.

### Rate Limiting
- Default: 100 requests/minute
- Auth endpoints: 5 requests/15 minutes
- File upload: 20 requests/minute
- Token refresh: 30 requests/minute

### Error Codes
- 400: Bad Request - Invalid input data
- 401: Unauthorized - Missing or invalid token
- 403: Forbidden - Insufficient permissions
- 404: Not Found - Resource does not exist
- 409: Conflict - Duplicate resource
- 429: Too Many Requests - Rate limit exceeded
- 500: Internal Server Error
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token',
      in: 'header',
    })
    .addTag('Auth', 'Authentication & authorization')
    .addTag('Public', 'Public API (No Authentication)')
    .addTag('Orders', 'Order management')
    .addTag('Finance', 'Financial operations - AR, AP, Cash, Invoice')
    .addTag('Warehouse', 'Warehouse operations - CN & VN')
    .addTag('Warehouse CN', 'Kho Trung Quốc')
    .addTag('Warehouse VN', 'Kho Việt Nam')
    .addTag('Logistics', 'Container, Delivery, Tracking')
    .addTag('Containers', 'Container management')
    .addTag('HR', 'Human resources - Employee, Attendance, Payroll')
    .addTag('CRM', 'Customer relationship management')
    .addTag('System', 'Dashboard, Approval, Notification, Task')
    .addTag('System - Dashboard', 'Dashboard & reporting')
    .addTag('Approvals', 'Approval workflows')
    .addTag('CMS', 'Content management system')
    .addTag('Blog', 'Blog & Content Management System')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (!['production', 'staging'].includes(configService.get<string>('app.env', 'development'))) {
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
      },
    });
  }

  // Graceful shutdown — ensures in-flight requests complete before Docker kills the process
  app.enableShutdownHooks();

  // WebSocket Redis adapter for horizontal scaling across multiple backend instances.
  // Falls back gracefully to in-memory adapter when @socket.io/redis-adapter is not
  // installed (development without Redis pub/sub) or when Redis is unreachable.
  // To enable: npm install @socket.io/redis-adapter  (redis is already in package.json)
  const redisIoAdapter = new RedisIoAdapter(app);
  try {
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  } catch (err) {
    const logger = new Logger('Bootstrap');
    logger.warn(
      `Redis IO adapter failed to connect (${err.message}). ` +
      'Falling back to default in-memory WebSocket adapter. ' +
      'Run: npm install @socket.io/redis-adapter to enable horizontal scaling.',
    );
    // The default in-memory adapter is used automatically when useWebSocketAdapter is not called.
  }

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`${appTitle} Backend running on http://localhost:${port}`);
  logger.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  logger.log(`WebSocket endpoint: ws://localhost:${port}/ws`);
  if (!['production', 'staging'].includes(configService.get<string>('app.env', 'development'))) {
    logger.log(`Swagger docs: http://localhost:${port}/api/v1/docs`);
    logger.log(`GraphQL Playground: http://localhost:${port}/graphql`);
    logger.log(`Bull Board: http://localhost:${port}/admin/queues`);
  }
}

bootstrap();
