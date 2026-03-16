import { Module, MiddlewareConsumer, NestModule, Logger, NestMiddleware } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { InjectQueue, BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';

/**
 * Middleware that restricts Bull Board access to CEO/COO/CFO roles.
 * Validates JWT from Authorization header or cookie.
 */
@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BullBoardAuthMiddleware.name);
  private readonly allowedRoles = ['CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS'];

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from Authorization header or cookie
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.cookies?.access_token as string);

      if (!token) {
        res.status(401).json({ message: 'Authentication required for Bull Board' });
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.role || !this.allowedRoles.includes(payload.role)) {
        this.logger.warn(
          `Unauthorized Bull Board access attempt by user ${payload.sub} with role ${payload.role}`,
        );
        res.status(403).json({ message: 'Insufficient permissions for Bull Board' });
        return;
      }

      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
}

@Module({
  imports: [
    JwtModule.register({}),
    BullModule.registerQueue(
      { name: 'order-events' },
      { name: 'notification-events' },
      { name: 'finance-events' },
      { name: 'warehouse-events' },
      { name: 'integration-events' },
    ),
  ],
  providers: [BullBoardAuthMiddleware],
})
export class BullBoardModule implements NestModule {
  private readonly logger = new Logger(BullBoardModule.name);

  constructor(
    @InjectQueue('order-events') private readonly orderQueue: Queue,
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('finance-events') private readonly financeQueue: Queue,
    @InjectQueue('warehouse-events') private readonly warehouseQueue: Queue,
    @InjectQueue('integration-events') private readonly integrationQueue: Queue,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.orderQueue) as any,
        new BullMQAdapter(this.notificationQueue) as any,
        new BullMQAdapter(this.financeQueue) as any,
        new BullMQAdapter(this.warehouseQueue) as any,
        new BullMQAdapter(this.integrationQueue) as any,
      ],
      serverAdapter,
    });

    this.logger.log('Bull Board admin UI mounted at /admin/queues (auth required)');

    // Apply auth middleware BEFORE the Bull Board router
    consumer
      .apply(BullBoardAuthMiddleware, serverAdapter.getRouter())
      .forRoutes('/admin/queues');
  }
}
