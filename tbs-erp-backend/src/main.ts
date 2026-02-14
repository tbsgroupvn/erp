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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Serve static files (for uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Security
  app.use(helmet());

  // Cookie parser (required for HttpOnly cookies)
  app.use(cookieParser());

  // CORS
  const corsOrigins = configService.get<string[]>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins,
    credentials: true, // Required for cookies to be sent cross-origin
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TBS ERP API')
    .setDescription('TBS Group - Logistics & Freight Forwarding ERP System')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Public', 'Public API (No Authentication)')
    .addTag('Auth', 'Xác thực & Phân quyền')
    .addTag('Orders', 'Quản lý Đơn hàng')
    .addTag('CRM', 'Quản lý Khách hàng')
    .addTag('Containers', 'Quản lý Container')
    .addTag('Warehouse CN', 'Kho Trung Quốc')
    .addTag('Warehouse VN', 'Kho Việt Nam')
    .addTag('Finance', 'Tài chính Kế toán')
    .addTag('Approvals', 'Phê duyệt')
    .addTag('Dashboard', 'Báo cáo')
    .addTag('Blog', 'Blog & Content Management System')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (configService.get<string>('app.env') !== 'production') {
    SwaggerModule.setup('api/docs', app, document);
  }

  // Health check
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`TBS ERP Backend running on http://localhost:${port}`);
  if (configService.get<string>('app.env') !== 'production') {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
