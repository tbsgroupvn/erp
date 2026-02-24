import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class GracePeriodService {
  private readonly logger = new Logger(GracePeriodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestGracePeriod(customerId: string, requestedDays: number, saleId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    // Create approval request
    const approval = await this.prisma.approval.create({
      data: {
        type: 'GRACE_PERIOD_REQUEST',
        referenceId: customerId,
        referenceCode: customer.code,
        requestedBy: saleId,
        requestData: { customerId, requestedDays, customerName: customer.fullName },
        status: 'PENDING',
      },
    });

    this.eventEmitter.emit('approval.created', { approvalId: approval.id, type: 'GRACE_PERIOD_REQUEST' });
    this.logger.log(`Grace period requested for customer ${customer.code}: ${requestedDays} days by ${saleId}`);
    return approval;
  }

  async onGracePeriodApproved(customerId: string, requestedDays: number) {
    const gracePeriodUntil = new Date();
    gracePeriodUntil.setDate(gracePeriodUntil.getDate() + requestedDays);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        gracePeriodUntil,
        isBlocked: false,
        blockReason: null,
        blockedAt: null,
      },
    });
    this.logger.log(`Grace period granted for customer ${customerId} until ${gracePeriodUntil.toISOString()}`);
  }
}
