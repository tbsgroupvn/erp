import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrderRepository, OrderWithRelations } from './order.repository';
import { OrderStatusMachine } from './domain/order-status.machine';

@Injectable()
export class OrderCancellationService {
  private readonly logger = new Logger(OrderCancellationService.name);

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly statusMachine: OrderStatusMachine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Cancels an order with a reason.
   *
   * Cancellation stages determine refund calculation and approval flow:
   * - Stage 1-2 (CONSULTING, QUOTATION — before deposit): No refund needed, Leader approves
   * - Stage 3 (PENDING_DEPOSIT — deposited, not purchased): Refund deposit minus admin fee (2%), Leader + GD KD approve
   * - Stage 4-6 (SOURCING, WAREHOUSE_CN, PACKING — purchased): Refund = deposit - costs incurred, GD KD + BGD approve
   * - Stage 7+ (CONSOLIDATION and beyond — shipped): Case-by-case, BGD approval only
   */
  async cancelOrder(id: string, reason: string, userId: string) {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Check if cancellation is allowed
    if (!this.statusMachine.canCancel(order.status)) {
      throw new BadRequestException(
        `Order in status ${order.status} cannot be cancelled. ` +
          `Orders that are IN_TRANSIT or beyond cannot be cancelled.`,
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Cancel reason must be at least 10 characters');
    }

    // Calculate refund based on cancellation stage
    const cancellation = this.calculateCancellationRefund(order);

    // Stage 1-2 with no deposit: direct cancellation with Leader approval if high value
    const needsApproval =
      cancellation.stage !== 'BEFORE_DEPOSIT' || Number(order.totalAmount) > 50_000_000;

    if (needsApproval) {
      return this.createCancellationApproval(order, cancellation, userId, reason);
    }

    // Direct cancellation (no approval needed — early stage, low value)
    const updated = await this.orderRepo.updateStatus(
      id,
      order.status,
      OrderStatus.CANCELLED,
      userId,
      `Cancelled: ${reason}`,
      { cancelReason: reason },
    );

    this.eventEmitter.emit('order.cancelled', {
      orderId: id,
      code: order.code,
      customerId: order.customerId,
      cancelledBy: userId,
      reason,
      previousStatus: order.status,
      cancellation,
    });

    this.logger.log(`Order ${order.code} cancelled by ${userId}: ${reason}`);

    return { status: 'CANCELLED', order: updated, cancellation };
  }

  /**
   * Creates an approval request for order cancellation with refund details.
   */
  private async createCancellationApproval(
    order: OrderWithRelations,
    cancellation: ReturnType<OrderCancellationService['calculateCancellationRefund']>,
    userId: string,
    reason: string,
  ) {
    const approvalSteps = this.getCancelApprovalSteps(cancellation.stage);
    const requestData = this.buildCancellationContext(order, cancellation, reason);

    const approval = await this.prisma.approval.create({
      data: {
        type: 'ORDER_CANCEL',
        referenceId: order.id,
        referenceCode: order.code,
        requestedBy: userId,
        requestData,
        totalSteps: approvalSteps.length,
        steps: {
          create: approvalSteps.map((step, index) => ({
            stepNumber: index + 1,
            approverRole: step as UserRole,
          })),
        },
      },
    });

    // Update order with cancel reason (but don't change status yet)
    await this.orderRepo.update(order.id, { cancelReason: reason });

    this.eventEmitter.emit('order.cancel.requested', {
      orderId: order.id,
      code: order.code,
      approvalId: approval.id,
      requestedBy: userId,
      reason,
      cancellation,
    });

    this.logger.log(
      `Cancel approval requested for order ${order.code} by ${userId} ` +
        `(stage=${cancellation.stage}, refund=${cancellation.refundAmount})`,
    );

    return {
      status: 'PENDING_APPROVAL',
      approvalId: approval.id,
      message: 'Cancellation requires approval. An approval request has been created.',
      cancellation,
    };
  }

  /**
   * Builds the context/metadata object for cancellation approval request data.
   */
  private buildCancellationContext(
    order: OrderWithRelations,
    cancellation: ReturnType<OrderCancellationService['calculateCancellationRefund']>,
    reason: string,
  ) {
    return {
      orderId: order.id,
      orderCode: order.code,
      currentStatus: order.status,
      totalAmount: Number(order.totalAmount),
      cancelReason: reason,
      cancellationStage: cancellation.stage,
      depositPaid: cancellation.depositPaid,
      adminFee: cancellation.adminFee,
      costsIncurred: cancellation.costsIncurred,
      refundAmount: cancellation.refundAmount,
      refundDetails: cancellation.details,
    };
  }

  /**
   * Calculate the refund amount based on the order's current stage.
   */
  private calculateCancellationRefund(order: OrderWithRelations) {
    const depositPaid = Number(order.depositPaid);
    const ADMIN_FEE_RATE = 0.02; // 2% admin fee

    // Stage 1-2: CONSULTING, QUOTATION — before deposit
    if (order.status === OrderStatus.CONSULTING || order.status === OrderStatus.QUOTATION) {
      return {
        stage: 'BEFORE_DEPOSIT' as const,
        depositPaid: 0,
        adminFee: 0,
        costsIncurred: 0,
        refundAmount: 0,
        details: 'No deposit has been paid. No refund needed.',
      };
    }

    // Stage 3: PENDING_DEPOSIT — deposited but not yet purchased
    if (order.status === OrderStatus.PENDING_DEPOSIT) {
      const adminFee = Math.ceil(depositPaid * ADMIN_FEE_RATE);
      const refundAmount = Math.max(0, depositPaid - adminFee);

      return {
        stage: 'DEPOSITED_NOT_PURCHASED' as const,
        depositPaid,
        adminFee,
        costsIncurred: 0,
        refundAmount,
        details:
          `Deposit paid: ${depositPaid.toLocaleString()} VND. ` +
          `Admin fee (2%): ${adminFee.toLocaleString()} VND. ` +
          `Refund amount: ${refundAmount.toLocaleString()} VND.`,
      };
    }

    // Stage 4-6: SOURCING, WAREHOUSE_CN, PACKING — goods purchased
    if (
      order.status === OrderStatus.SOURCING ||
      order.status === OrderStatus.WAREHOUSE_CN ||
      order.status === OrderStatus.PACKING
    ) {
      // Estimate costs incurred from payment vouchers
      const costsIncurred = this.estimateCostsIncurred(order);
      const adminFee = Math.ceil(depositPaid * ADMIN_FEE_RATE);
      const refundAmount = Math.max(0, depositPaid - costsIncurred - adminFee);

      return {
        stage: 'GOODS_PURCHASED' as const,
        depositPaid,
        adminFee,
        costsIncurred,
        refundAmount,
        details:
          `Deposit paid: ${depositPaid.toLocaleString()} VND. ` +
          `Costs incurred: ${costsIncurred.toLocaleString()} VND. ` +
          `Admin fee (2%): ${adminFee.toLocaleString()} VND. ` +
          `Refund amount: ${refundAmount.toLocaleString()} VND.`,
      };
    }

    // Stage 7+: CONSOLIDATION and beyond — shipped, case-by-case
    const costsIncurred = this.estimateCostsIncurred(order);
    return {
      stage: 'SHIPPED' as const,
      depositPaid,
      adminFee: 0,
      costsIncurred,
      refundAmount: 0,
      details:
        `Order is in ${order.status} stage. Case-by-case review required. ` +
        `Deposit paid: ${depositPaid.toLocaleString()} VND. ` +
        `Estimated costs incurred: ${costsIncurred.toLocaleString()} VND. ` +
        `Refund to be determined by BGD.`,
    };
  }

  /**
   * Estimate costs incurred for an order based on approved payment vouchers.
   */
  private estimateCostsIncurred(order: OrderWithRelations): number {
    if (!order.paymentVouchers || order.paymentVouchers.length === 0) {
      return 0;
    }

    return order.paymentVouchers
      .filter((v) => v.status === 'APPROVED' && v.type === 'PAYMENT')
      .reduce((sum, v) => sum + Number(v.amount), 0);
  }

  /**
   * Determine the approval steps required for a cancellation stage.
   */
  private getCancelApprovalSteps(
    stage: 'BEFORE_DEPOSIT' | 'DEPOSITED_NOT_PURCHASED' | 'GOODS_PURCHASED' | 'SHIPPED',
  ): string[] {
    switch (stage) {
      case 'BEFORE_DEPOSIT':
        // Leader approves
        return ['SALES_LEADER'];

      case 'DEPOSITED_NOT_PURCHASED':
        // Leader + GD KD approve
        return ['SALES_LEADER', 'SALES_DIRECTOR'];

      case 'GOODS_PURCHASED':
        // GD KD + BGD approve
        return ['SALES_DIRECTOR', 'COO'];

      case 'SHIPPED':
        // BGD approval only
        return ['COO'];

      default:
        return ['SALES_LEADER'];
    }
  }
}
