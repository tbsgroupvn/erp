import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { OrderStatus } from '@prisma/client';

export interface CancelApprovalCompletedEvent {
  orderId: string;
  status: 'APPROVED' | 'REJECTED';
  approverId: string;
}

/**
 * Listens for order.cancel.approval.completed events.
 *
 * When an ORDER_CANCEL approval is APPROVED:
 *  1. Transitions order to CANCELLED
 *  2. Cancels related supplier orders
 *  3. Refunds wallet (if refundAmount > 0)
 *  4. Emits order.cancelled event
 *
 * When REJECTED:
 *  1. Clears cancelReason on the order
 */
@Injectable()
export class CancelApprovalListener {
  private readonly logger = new Logger(CancelApprovalListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('order.cancel.approval.completed')
  async handleCancelApprovalCompleted(event: CancelApprovalCompletedEvent): Promise<void> {
    this.logger.log(
      `Cancel approval completed: orderId=${event.orderId}, status=${event.status}`,
    );

    try {
      if (event.status === 'APPROVED') {
        await this.handleApproved(event);
      } else if (event.status === 'REJECTED') {
        await this.handleRejected(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process cancel approval for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleApproved(event: CancelApprovalCompletedEvent): Promise<void> {
    // 1. Load approval to get requestData (refundAmount, customerId, etc.)
    // NOTE: Don't filter by status='APPROVED' — the event is emitted inside the
    // approval engine's transaction, so the APPROVED status may not be committed yet.
    // The event itself already confirms the approval was approved.
    const approval = await this.prisma.approval.findFirst({
      where: {
        referenceId: event.orderId,
        type: 'ORDER_CANCEL',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!approval) {
      this.logger.warn(`No ORDER_CANCEL approval found for order ${event.orderId}`);
      return;
    }

    const requestData = approval.requestData as Record<string, any> | null;

    // 2. Load current order
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
    });

    if (!order) {
      this.logger.warn(`Order ${event.orderId} not found`);
      return;
    }

    if (order.status === OrderStatus.CANCELLED) {
      this.logger.log(`Order ${order.code} already CANCELLED, skipping`);
      return;
    }

    const previousStatus = order.status;

    // 3. Transition order -> CANCELLED + create status history (in transaction)
    await this.prisma.executeInTransaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: previousStatus,
          toStatus: OrderStatus.CANCELLED,
          changedBy: event.approverId,
          note: `Auto-cancelled after approval approved`,
        },
      });
    });

    this.logger.log(`Order ${order.code} transitioned to CANCELLED`);

    // 4. Cancel related supplier orders
    const supplierOrders = await this.prisma.supplierOrder.findMany({
      where: {
        orderId: order.id,
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    });

    for (const so of supplierOrders) {
      await this.prisma.supplierOrder.update({
        where: { id: so.id },
        data: { status: 'CANCELLED' },
      });
      this.logger.log(`SupplierOrder ${so.code} cancelled (parent order cancelled)`);
    }

    // 5. Refund wallet if refundAmount > 0
    const customerId = order.customerId;
    const refundAmount = requestData?.refundAmount ? Number(requestData.refundAmount) : 0;

    if (refundAmount > 0 && customerId) {
      await this.walletService.refund(
        customerId,
        refundAmount,
        order.code,
        `Hoan tien huy don ${order.code}`,
      );
      this.logger.log(
        `Wallet refund: ${refundAmount} VND for customer ${customerId} (order ${order.code})`,
      );
    }

    // 6. Clawback commission
    this.eventEmitter.emit('order.commission.clawback', {
      orderId: order.id,
      reason: `Don hang ${order.code} bi huy`,
      triggeredBy: event.approverId,
    });

    // 7. Emit order.cancelled event
    this.eventEmitter.emit('order.cancelled', {
      orderId: order.id,
      code: order.code,
      customerId: order.customerId,
      cancelledBy: event.approverId,
      reason: requestData?.cancelReason || order.cancelReason,
      previousStatus,
      cancellation: {
        stage: requestData?.cancellationStage,
        depositPaid: requestData?.depositPaid,
        adminFee: requestData?.adminFee,
        costsIncurred: requestData?.costsIncurred,
        refundAmount,
      },
    });
  }

  private async handleRejected(event: CancelApprovalCompletedEvent): Promise<void> {
    await this.prisma.order.update({
      where: { id: event.orderId },
      data: { cancelReason: null },
    });
    this.logger.log(`Cancel rejected for order ${event.orderId}, cancelReason cleared`);
  }
}
