import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalType, OrderStatus, SupplierOrderStatus } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { ApprovalService } from '@modules/approval/approval.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { AccountsReceivableService } from '@modules/accounts-receivable/accounts-receivable.service';
import { RETURN_REQUESTABLE_STATUSES } from '@common/constants/order-status.enum';
import { generateCode } from '@common/utils/code-generator.util';
import { PenaltyCalculatorService, PenaltyPreview } from './penalty-calculator.service';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';

@Injectable()
export class ReturnRequestService {
  private readonly logger = new Logger(ReturnRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltyCalculator: PenaltyCalculatorService,
    private readonly approvalService: ApprovalService,
    private readonly walletService: WalletService,
    private readonly arService: AccountsReceivableService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async previewPenalty(orderId: string): Promise<PenaltyPreview> {
    return this.penaltyCalculator.previewPenalty(orderId);
  }

  async createReturnRequest(
    orderId: string,
    dto: CreateReturnRequestDto,
    userId: string,
  ) {
    // 1. Validate order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        status: true,
        totalAmount: true,
        depositPaid: true,
        customerId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (!RETURN_REQUESTABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot request return for order in status ${order.status}`,
      );
    }

    // 2. Check no pending return request
    const existing = await this.prisma.returnRequest.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Order already has a pending return request: ${existing.code}`,
      );
    }

    // 3. Calculate penalty
    const config = await this.penaltyCalculator.getConfig(order.status);
    if (!config) {
      throw new BadRequestException(
        `No penalty config for stage ${order.status}`,
      );
    }

    const totalAmount = Number(order.totalAmount);
    const depositPaid = Number(order.depositPaid);

    const penalty = this.penaltyCalculator.calculatePenalty(
      totalAmount,
      Number(config.penaltyPercent),
      Number(config.reverseShippingPercent),
    );

    // 4. Generate code
    const code = await generateCode(this.prisma.returnRequest, {
      prefix: 'RR',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });

    // 5. Create ReturnRequest + Approval in transaction
    const returnRequest = await this.prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          code,
          orderId: order.id,
          customerId: order.customerId,
          orderStatus: order.status,
          orderTotalAmount: totalAmount,
          depositPaid,
          penaltyPercent: penalty.penaltyPercent,
          penaltyAmount: penalty.penaltyAmount,
          reverseShippingPercent: penalty.reverseShippingPercent,
          reverseShippingAmount: penalty.reverseShippingAmount,
          totalPenalty: penalty.totalPenalty,
          reason: dto.reason,
          attachments: dto.attachments ?? [],
          requestedBy: userId,
          status: 'PENDING',
        },
      });

      return rr;
    });

    // 6. Create Approval (outside transaction to allow event emission)
    try {
      const approval = await this.approvalService.createApprovalRequest(
        ApprovalType.RETURN_REQUEST,
        returnRequest.id,
        userId,
        {
          referenceCode: returnRequest.code,
          requestData: {
            orderId: order.id,
            orderCode: order.code,
            totalPenalty: penalty.totalPenalty,
          },
        },
      );

      // Update approvalId
      await this.prisma.returnRequest.update({
        where: { id: returnRequest.id },
        data: { approvalId: approval.id },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create approval for return request ${returnRequest.code}: ${error.message}`,
      );
    }

    // 7. Emit event
    this.eventEmitter.emit('order.return.requested', {
      returnRequestId: returnRequest.id,
      orderId: order.id,
      orderCode: order.code,
      customerId: order.customerId,
      requestedBy: userId,
    });

    this.logger.log(
      `Return request ${returnRequest.code} created for order ${order.code}`,
    );

    return returnRequest;
  }

  async executeReturnRequest(
    returnRequestId: string,
    approverId: string,
  ) {
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
    });

    if (!rr) {
      throw new NotFoundException(`ReturnRequest ${returnRequestId} not found`);
    }

    if (rr.status !== 'PENDING' && rr.status !== 'APPROVED') {
      throw new BadRequestException(
        `ReturnRequest is in status ${rr.status}, cannot execute`,
      );
    }

    const depositPaid = Number(rr.depositPaid);
    const totalPenalty = Number(rr.totalPenalty);

    // Get wallet balance for cascade
    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId: rr.customerId },
      select: { balance: true },
    });
    const walletBalance = wallet ? Number(wallet.balance) : 0;

    // Calculate cascade
    const deductFromDeposit = Math.min(depositPaid, totalPenalty);
    let remaining = totalPenalty - deductFromDeposit;
    const deductFromWallet = Math.min(walletBalance, remaining);
    remaining -= deductFromWallet;
    const writeToAR = remaining;
    const refundToCustomer = Math.max(0, depositPaid - totalPenalty);

    // Execute in transaction
    await this.prisma.$transaction(async (tx) => {
      // a. Deduct from deposit (reduce order.depositPaid)
      if (deductFromDeposit > 0) {
        await tx.order.update({
          where: { id: rr.orderId },
          data: {
            depositPaid: { decrement: deductFromDeposit },
          },
        });
      }

      // b. Update return request with deduction details
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          status: 'PROCESSING',
          deductedFromDeposit: deductFromDeposit,
          deductedFromWallet: deductFromWallet,
          writtenToAR: writeToAR,
          refundToCustomer: refundToCustomer,
        },
      });

      // c. Transition order to RETURNED + status history
      await tx.order.update({
        where: { id: rr.orderId },
        data: { status: OrderStatus.RETURNED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: rr.orderId,
          fromStatus: rr.orderStatus,
          toStatus: OrderStatus.RETURNED,
          changedBy: approverId,
          note: `Return request ${rr.code} approved. Penalty: ${totalPenalty}`,
        },
      });

      // d. Cancel related supplier orders
      await tx.supplierOrder.updateMany({
        where: {
          orderId: rr.orderId,
          status: {
            notIn: [
              SupplierOrderStatus.CANCELLED,
              SupplierOrderStatus.REFUNDED,
            ],
          },
        },
        data: {
          status: SupplierOrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // e. Mark return request as COMPLETED
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          status: 'COMPLETED',
          resolvedBy: approverId,
          resolvedAt: new Date(),
        },
      });
    });

    // Wallet operations outside transaction (they have their own locks)
    if (deductFromWallet > 0) {
      await this.walletService.deduct(
        rr.customerId,
        deductFromWallet,
        rr.orderId,
        `Return penalty for order (${rr.code})`,
      );
    }

    // Write to AR if shortfall
    if (writeToAR > 0) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await this.arService.createReceivable(
        {
          customerId: rr.customerId,
          orderId: rr.orderId,
          amount: writeToAR,
          currency: 'VND',
          dueDate: dueDate.toISOString(),
          note: `Return penalty shortfall for ${rr.code}`,
        },
        approverId,
      );
    }

    // Refund excess deposit to wallet
    if (refundToCustomer > 0) {
      await this.walletService.refund(
        rr.customerId,
        refundToCustomer,
        rr.orderId,
        `Deposit refund after return penalty for ${rr.code}`,
      );
    }

    // Clawback commission
    this.eventEmitter.emit('order.commission.clawback', {
      orderId: rr.orderId,
      reason: `Don hang hoan tra. Ma yeu cau: ${rr.code}`,
      triggeredBy: approverId,
    });

    // Emit event
    this.eventEmitter.emit('order.returned', {
      returnRequestId,
      orderId: rr.orderId,
      customerId: rr.customerId,
      totalPenalty,
      deductedFromDeposit: deductFromDeposit,
      deductedFromWallet: deductFromWallet,
      writtenToAR: writeToAR,
      refundToCustomer,
    });

    this.logger.log(
      `Return request ${rr.code} executed. Penalty=${totalPenalty}, Deposit=${deductFromDeposit}, Wallet=${deductFromWallet}, AR=${writeToAR}, Refund=${refundToCustomer}`,
    );
  }

  async rejectReturnRequest(
    returnRequestId: string,
    approverId: string,
    note?: string,
  ) {
    const rr = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
    });

    if (!rr) {
      throw new NotFoundException(`ReturnRequest ${returnRequestId} not found`);
    }

    await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: 'REJECTED',
        rejectionNote: note || null,
        resolvedBy: approverId,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`Return request ${rr.code} rejected by ${approverId}`);
  }

  async findByOrderId(orderId: string) {
    return this.prisma.returnRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
