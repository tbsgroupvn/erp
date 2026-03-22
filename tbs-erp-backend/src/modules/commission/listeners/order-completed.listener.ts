import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommissionCalculatorService } from '../services/commission-calculator.service';
import { PrismaService } from '@core/database/prisma.service';

export interface OrderStatusChangedEvent {
  orderId: string;
  code: string;
  customerId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  serviceType: string;
}

/**
 * Listens for order.status.changed events.
 * When an order is COMPLETED, auto-calculates the sales commission.
 */
@Injectable()
export class OrderCompletedListener {
  private readonly logger = new Logger(OrderCompletedListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionCalculator: CommissionCalculatorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('order.status.changed')
  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.toStatus !== 'COMPLETED') {
      return;
    }

    this.logger.log(`Order ${event.code} completed — calculating commission`);

    try {
      // Check if commission already exists for this order
      const existing = await this.prisma.commissionRecord.findFirst({
        where: { orderId: event.orderId },
      });

      if (existing) {
        this.logger.warn(`Commission already exists for order ${event.code} (${existing.id})`);
        return;
      }

      // Get full order details
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          code: true,
          saleId: true,
          serviceType: true,
          totalAmount: true,
          costAllocations: {
            select: {
              allocatedAmount: true,
            },
          },
          costAdjustments: {
            where: { status: 'APPROVED' },
            select: { amount: true },
          },
        },
      });

      if (!order) {
        this.logger.error(`Order ${event.orderId} not found`);
        return;
      }

      // Calculate commission using CommissionCalculatorService
      const result = await this.commissionCalculator.calculateCommission(order);

      if (!result) {
        this.logger.log(`No applicable commission rule for order ${event.code}`);
        return;
      }

      // Create CommissionRecord with status PENDING
      // Use try/catch for P2002 (unique constraint on orderId) to handle concurrent events
      let commission;
      try {
        commission = await this.prisma.commissionRecord.create({
          data: {
            orderId: order.id,
            saleId: order.saleId,
            orderRevenue: result.revenue,
            orderCost: result.cost,
            netProfit: result.profit,
            commissionRate: result.rate,
            commissionAmount: result.amount,
            status: 'PENDING',
          },
        });
      } catch (createError) {
        if (createError.code === 'P2002') {
          this.logger.warn(`Commission already exists for order ${event.code} (duplicate event)`);
          return;
        }
        throw createError;
      }

      this.logger.log(
        `Commission PENDING created for order ${event.code}: revenue=${result.revenue}, cost=${result.cost}, profit=${result.profit}, commission=${result.amount}`,
      );

      // Auto-approve commissions below threshold
      const autoApproveThreshold = this.configService.get<number>(
        'business.commission.autoApproveThreshold',
        1_000_000,
      );

      if (result.amount < autoApproveThreshold) {
        await this.prisma.commissionRecord.update({
          where: { id: commission.id },
          data: {
            status: 'APPROVED',
            approvedBy: 'SYSTEM',
            approvedAt: new Date(),
          },
        });

        this.logger.log(
          `Commission auto-approved for order ${event.code}: ${result.amount} < ${autoApproveThreshold}`,
        );

        this.eventEmitter.emit('commission.auto_approved', {
          commissionId: commission.id,
          orderId: order.id,
          orderCode: event.code,
          saleId: order.saleId,
          commissionAmount: result.amount,
        });
        return;
      }

      // Emit commission.pending event for notification
      this.eventEmitter.emit('commission.pending', {
        commissionId: commission.id,
        orderId: order.id,
        orderCode: event.code,
        saleId: order.saleId,
        commissionAmount: result.amount,
        netProfit: result.profit,
        createdAt: commission.createdAt,
      });
    } catch (error) {
      this.logger.error(
        `Failed to calculate commission for order ${event.code}: ${error.message}`,
        error.stack,
      );
    }
  }
}
