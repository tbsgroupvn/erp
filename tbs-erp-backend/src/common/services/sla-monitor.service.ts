import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface SLABreachItem {
  type: string;
  referenceId: string;
  referenceCode: string;
  expectedResponseTime: Date;
  actualDurationMinutes: number;
  limitMinutes: number;
  assignedTo?: string;
}

@Injectable()
export class SLAMonitorService {
  private readonly logger = new Logger(SLAMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check all SLA requirements for a specific order.
   * Returns a list of SLA items with their current status.
   */
  async checkOrderSLA(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        statusHistory: { orderBy: { createdAt: 'desc' } },
        customer: { select: { id: true, code: true, fullName: true } },
      },
    });

    if (!order) {
      return { orderId, breaches: [], status: 'NOT_FOUND' };
    }

    const slaConfig = this.getSLAConfig();
    const now = new Date();
    const breaches: SLABreachItem[] = [];

    // Check SLA based on current status
    const latestHistory = order.statusHistory[0];
    if (!latestHistory) {
      return { orderId, breaches, status: 'OK' };
    }

    const statusDurationMinutes = Math.floor(
      (now.getTime() - latestHistory.createdAt.getTime()) / (1000 * 60),
    );

    // SLA: Sale contact after lead (CONSULTING stage)
    if (order.status === OrderStatus.CONSULTING) {
      const limitMinutes = slaConfig.saleContactHours * 60;
      if (statusDurationMinutes > limitMinutes) {
        breaches.push({
          type: 'SALE_CONTACT',
          referenceId: order.id,
          referenceCode: order.code,
          expectedResponseTime: new Date(
            latestHistory.createdAt.getTime() + limitMinutes * 60 * 1000,
          ),
          actualDurationMinutes: statusDurationMinutes,
          limitMinutes,
          assignedTo: order.saleId,
        });
      }
    }

    // SLA: Quotation turnaround
    if (order.status === OrderStatus.QUOTATION) {
      const limitMinutes = slaConfig.quotationHours * 60;
      if (statusDurationMinutes > limitMinutes) {
        breaches.push({
          type: 'QUOTATION_TURNAROUND',
          referenceId: order.id,
          referenceCode: order.code,
          expectedResponseTime: new Date(
            latestHistory.createdAt.getTime() + limitMinutes * 60 * 1000,
          ),
          actualDurationMinutes: statusDurationMinutes,
          limitMinutes,
          assignedTo: order.saleId,
        });
      }
    }

    // SLA: Warehouse receipt (WAREHOUSE_CN or WAREHOUSE_VN stage)
    if (order.status === OrderStatus.WAREHOUSE_CN || order.status === OrderStatus.WAREHOUSE_VN) {
      const limitMinutes = slaConfig.warehouseReceiptHours * 60;
      if (statusDurationMinutes > limitMinutes) {
        breaches.push({
          type: 'WAREHOUSE_RECEIPT',
          referenceId: order.id,
          referenceCode: order.code,
          expectedResponseTime: new Date(
            latestHistory.createdAt.getTime() + limitMinutes * 60 * 1000,
          ),
          actualDurationMinutes: statusDurationMinutes,
          limitMinutes,
        });
      }
    }

    // SLA: Delivery turnaround
    if (order.status === OrderStatus.DELIVERING) {
      const limitMinutes = slaConfig.deliveryDays * 24 * 60;
      if (statusDurationMinutes > limitMinutes) {
        breaches.push({
          type: 'DELIVERY',
          referenceId: order.id,
          referenceCode: order.code,
          expectedResponseTime: new Date(
            latestHistory.createdAt.getTime() + limitMinutes * 60 * 1000,
          ),
          actualDurationMinutes: statusDurationMinutes,
          limitMinutes,
        });
      }
    }

    return {
      orderId,
      orderCode: order.code,
      currentStatus: order.status,
      breaches,
      status: breaches.length > 0 ? 'BREACHED' : 'OK',
    };
  }

  /**
   * Returns all currently overdue SLA items across all active orders.
   */
  async getOverdueSLAs(): Promise<SLABreachItem[]> {
    const slaConfig = this.getSLAConfig();
    const now = new Date();
    const allBreaches: SLABreachItem[] = [];

    // Find orders in statuses that have SLA requirements
    const slaStatuses: OrderStatus[] = [
      OrderStatus.CONSULTING,
      OrderStatus.QUOTATION,
      OrderStatus.WAREHOUSE_CN,
      OrderStatus.WAREHOUSE_VN,
      OrderStatus.DELIVERING,
    ];

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: slaStatuses },
      },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const order of orders) {
      const latestHistory = order.statusHistory[0];
      if (!latestHistory) continue;

      const statusDurationMinutes = Math.floor(
        (now.getTime() - latestHistory.createdAt.getTime()) / (1000 * 60),
      );

      let limitMinutes = 0;
      let slaType = '';

      switch (order.status) {
        case OrderStatus.CONSULTING:
          limitMinutes = slaConfig.saleContactHours * 60;
          slaType = 'SALE_CONTACT';
          break;
        case OrderStatus.QUOTATION:
          limitMinutes = slaConfig.quotationHours * 60;
          slaType = 'QUOTATION_TURNAROUND';
          break;
        case OrderStatus.WAREHOUSE_CN:
        case OrderStatus.WAREHOUSE_VN:
          limitMinutes = slaConfig.warehouseReceiptHours * 60;
          slaType = 'WAREHOUSE_RECEIPT';
          break;
        case OrderStatus.DELIVERING:
          limitMinutes = slaConfig.deliveryDays * 24 * 60;
          slaType = 'DELIVERY';
          break;
      }

      if (limitMinutes > 0 && statusDurationMinutes > limitMinutes) {
        allBreaches.push({
          type: slaType,
          referenceId: order.id,
          referenceCode: order.code,
          expectedResponseTime: new Date(
            latestHistory.createdAt.getTime() + limitMinutes * 60 * 1000,
          ),
          actualDurationMinutes: statusDurationMinutes,
          limitMinutes,
          assignedTo: order.saleId,
        });
      }
    }

    return allBreaches;
  }

  /**
   * Cron job: Check for SLA breaches every 30 minutes and emit events.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkSLABreaches(): Promise<void> {
    const breaches = await this.getOverdueSLAs();

    if (breaches.length === 0) {
      return;
    }

    this.logger.warn(`SLA check: found ${breaches.length} breach(es)`);

    for (const breach of breaches) {
      this.eventEmitter.emit('sla.breached', {
        type: breach.type,
        referenceId: breach.referenceId,
        referenceCode: breach.referenceCode,
        expectedResponseTime: breach.expectedResponseTime,
        actualDurationMinutes: breach.actualDurationMinutes,
        limitMinutes: breach.limitMinutes,
        assignedTo: breach.assignedTo,
      });
    }

    // Emit summary event
    this.eventEmitter.emit('sla.check.completed', {
      totalBreaches: breaches.length,
      breachesByType: breaches.reduce(
        (acc, b) => {
          acc[b.type] = (acc[b.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      checkedAt: new Date(),
    });
  }

  /**
   * Get SLA configuration values from business config.
   */
  private getSLAConfig() {
    return {
      cskhResponseMinutes: this.configService.get<number>('business.sla.cskhResponseMinutes', 15),
      saleContactHours: this.configService.get<number>('business.sla.saleContactHours', 2),
      quotationHours: this.configService.get<number>('business.sla.quotationHours', 4),
      approvalHours: this.configService.get<number>('business.sla.approvalHours', 2),
      warehouseReceiptHours: this.configService.get<number>(
        'business.sla.warehouseReceiptHours',
        24,
      ),
      deliveryDays: this.configService.get<number>('business.sla.deliveryDays', 3),
    };
  }
}
