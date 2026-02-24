import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SagaOrchestrator, SagaStep } from '@common/patterns/saga';

interface OrderCompletionContext {
  orderId: string;
  completedBy: string;
  // Populated during execution
  order?: any;
  arId?: string;
  commissionId?: string;
  invoiceId?: string;
  previousStatus?: string;
}

@Injectable()
export class OrderCompletionSaga {
  private readonly logger = new Logger(OrderCompletionSaga.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(orderId: string, completedBy: string): Promise<OrderCompletionContext> {
    const saga = new SagaOrchestrator<OrderCompletionContext>('OrderCompletion');

    saga
      .addStep(this.validateAndLockOrder())
      .addStep(this.createAccountReceivable())
      .addStep(this.calculateCommission())
      .addStep(this.generateInvoice())
      .addStep(this.updateOrderStatus())
      .addStep(this.emitCompletionEvents());

    return saga.execute({ orderId, completedBy });
  }

  private validateAndLockOrder(): SagaStep<OrderCompletionContext> {
    return {
      name: 'ValidateAndLockOrder',
      execute: async (ctx) => {
        const order = await this.prisma.order.findUnique({
          where: { id: ctx.orderId },
          include: { customer: true, items: true },
        });

        if (!order) throw new Error(`Order ${ctx.orderId} not found`);
        if (order.status === 'COMPLETED') throw new Error('Order already completed');
        if (order.status === 'CANCELLED') throw new Error('Cannot complete cancelled order');

        ctx.order = order;
        ctx.previousStatus = order.status;
        return ctx;
      },
      compensate: async (ctx) => ctx, // Nothing to compensate for validation
    };
  }

  private createAccountReceivable(): SagaStep<OrderCompletionContext> {
    return {
      name: 'CreateAccountReceivable',
      execute: async (ctx) => {
        const existing = await this.prisma.accountReceivable.findFirst({
          where: { orderId: ctx.orderId },
        });

        if (existing) {
          ctx.arId = existing.id;
          return ctx;
        }

        const count = await this.prisma.accountReceivable.count();
        const code = `TBS-AR-${String(count + 1).padStart(6, '0')}`;

        const ar = await this.prisma.accountReceivable.create({
          data: {
            code,
            customerId: ctx.order.customerId,
            orderId: ctx.orderId,
            amount: ctx.order.totalAmount,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            createdBy: ctx.completedBy,
          },
        });

        ctx.arId = ar.id;
        return ctx;
      },
      compensate: async (ctx) => {
        if (ctx.arId) {
          await this.prisma.accountReceivable.update({ where: { id: ctx.arId }, data: { status: 'CANCELLED' } }).catch((err) => this.logger.error(`Failed to cancel AR ${ctx.arId}: ${err.message}`));
          this.logger.warn(`Compensated: Cancelled AR ${ctx.arId}`);
        }
        return ctx;
      },
    };
  }

  private calculateCommission(): SagaStep<OrderCompletionContext> {
    return {
      name: 'CalculateCommission',
      execute: async (ctx) => {
        const existing = await this.prisma.commissionRecord.findFirst({
          where: { orderId: ctx.orderId },
        });

        if (existing) {
          ctx.commissionId = existing.id;
          return ctx;
        }

        // Emit event for commission calculation service to handle
        this.eventEmitter.emit('order.commission.calculate', {
          orderId: ctx.orderId,
          saleId: ctx.order.saleId,
          totalAmount: ctx.order.totalAmount,
        });

        return ctx;
      },
      compensate: async (ctx) => {
        if (ctx.commissionId) {
          await this.prisma.commissionRecord.update({ where: { id: ctx.commissionId }, data: { status: 'CANCELLED' } }).catch((err) => this.logger.error(`Failed to cancel commission ${ctx.commissionId}: ${err.message}`));
          this.logger.warn(`Compensated: Cancelled commission ${ctx.commissionId}`);
        }
        return ctx;
      },
    };
  }

  private generateInvoice(): SagaStep<OrderCompletionContext> {
    return {
      name: 'GenerateInvoice',
      execute: async (ctx) => {
        const existing = await this.prisma.invoice.findFirst({
          where: { orderId: ctx.orderId },
        });

        if (existing) {
          ctx.invoiceId = existing.id;
          return ctx;
        }

        const count = await this.prisma.invoice.count();
        const code = `TBS-INV-${String(count + 1).padStart(6, '0')}`;
        const taxRate = 0.1;
        const amount = Number(ctx.order.totalAmount);
        const taxAmount = amount * taxRate;

        const invoice = await this.prisma.invoice.create({
          data: {
            code,
            orderId: ctx.orderId,
            customerId: ctx.order.customerId,
            amount: ctx.order.totalAmount,
            taxAmount,
            totalAmount: amount + taxAmount,
            createdBy: ctx.completedBy,
          },
        });

        ctx.invoiceId = invoice.id;
        return ctx;
      },
      compensate: async (ctx) => {
        if (ctx.invoiceId) {
          await this.prisma.invoice.update({ where: { id: ctx.invoiceId }, data: { status: 'CANCELLED' } }).catch((err) => this.logger.error(`Failed to cancel invoice ${ctx.invoiceId}: ${err.message}`));
          this.logger.warn(`Compensated: Cancelled invoice ${ctx.invoiceId}`);
        }
        return ctx;
      },
    };
  }

  private updateOrderStatus(): SagaStep<OrderCompletionContext> {
    return {
      name: 'UpdateOrderStatus',
      execute: async (ctx) => {
        await this.prisma.order.update({
          where: { id: ctx.orderId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        return ctx;
      },
      compensate: async (ctx) => {
        if (ctx.previousStatus) {
          await this.prisma.order.update({
            where: { id: ctx.orderId },
            data: { status: ctx.previousStatus as any, completedAt: null },
          });
          this.logger.warn(`Compensated: Reverted order status to ${ctx.previousStatus}`);
        }
        return ctx;
      },
    };
  }

  private emitCompletionEvents(): SagaStep<OrderCompletionContext> {
    return {
      name: 'EmitCompletionEvents',
      execute: async (ctx) => {
        this.eventEmitter.emit('order.completed', {
          orderId: ctx.orderId,
          customerId: ctx.order.customerId,
          arId: ctx.arId,
          invoiceId: ctx.invoiceId,
          completedBy: ctx.completedBy,
        });
        return ctx;
      },
      compensate: async (ctx) => ctx, // Events can't be un-emitted; downstream handlers should be idempotent
    };
  }
}
