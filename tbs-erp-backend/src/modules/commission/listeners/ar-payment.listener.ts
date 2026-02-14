import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

export interface ArPaymentRecordedEvent {
  arId: string;
  customerId: string;
  paymentAmount: number;
  isFullyPaid: boolean;
  reference?: string;
}

/**
 * Listens for ar.payment.recorded events.
 * When AR is fully paid, automatically approves the related commission.
 */
@Injectable()
export class ArPaymentListener {
  private readonly logger = new Logger(ArPaymentListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('ar.payment.recorded')
  async handleArPaymentRecorded(
    event: ArPaymentRecordedEvent,
  ): Promise<void> {
    // Only process fully paid ARs
    if (!event.isFullyPaid) {
      this.logger.log(
        `AR ${event.arId} partially paid, commission approval pending full payment`,
      );
      return;
    }

    this.logger.log(
      `AR ${event.arId} fully paid — processing commission auto-approval`,
    );

    try {
      // Find the AR record to get the orderId
      const ar = await this.prisma.accountReceivable.findUnique({
        where: { id: event.arId },
        select: {
          id: true,
          code: true,
          orderId: true,
          order: {
            select: {
              id: true,
              code: true,
            },
          },
        },
      });

      if (!ar?.orderId) {
        this.logger.warn(
          `AR ${event.arId} has no linked order, skipping commission approval`,
        );
        return;
      }

      // Find the commission record for this order
      const commission = await this.prisma.commissionRecord.findFirst({
        where: {
          orderId: ar.orderId,
          status: 'PENDING',
        },
      });

      if (!commission) {
        this.logger.log(
          `No PENDING commission found for order ${ar.order?.code}`,
        );
        return;
      }

      // Update commission status from PENDING to APPROVED
      const updated = await this.prisma.commissionRecord.update({
        where: { id: commission.id },
        data: {
          status: 'APPROVED',
          approvedBy: 'SYSTEM_AUTO',
          approvedAt: new Date(),
        },
      });

      this.logger.log(
        `Commission ${commission.id} auto-approved for order ${ar.order?.code} (AR ${ar.code} fully paid)`,
      );

      // Emit commission.approved event for notification
      this.eventEmitter.emit('commission.approved', {
        commissionId: updated.id,
        orderId: ar.orderId,
        orderCode: ar.order?.code,
        saleId: updated.saleId,
        commissionAmount: updated.commissionAmount,
        approvedBy: 'SYSTEM_AUTO',
        approvedAt: updated.approvedAt,
        arId: ar.id,
        arCode: ar.code,
      });
    } catch (error) {
      this.logger.error(
        `Failed to auto-approve commission for AR ${event.arId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
