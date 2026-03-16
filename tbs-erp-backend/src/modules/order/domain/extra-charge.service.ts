import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { ApprovalService } from '@modules/approval/approval.service';
import { ApprovalType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface AddExtraChargeDto {
  chargeType: string;
  amount: number;
  currency?: string;
  description?: string;
  imageUrls?: string[];
}

/**
 * B8: Extra Charge Service.
 *
 * Manages extra charges (phu phi phat sinh) for orders.
 * When an extra charge is added, the order goes ON_HOLD until the charge
 * is approved or rejected.
 */
@Injectable()
export class ExtraChargeService {
  private readonly logger = new Logger(ExtraChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly approvalService: ApprovalService,
  ) {}

  /**
   * Add an extra charge to an order.
   * Sets charge status to PENDING and puts the order ON_HOLD.
   */
  async addExtraCharge(orderId: string, dto: AddExtraChargeDto, createdBy: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Neu order da ON_HOLD (tu charge khac), tim trang thai goc tu charge dau tien
    let savedPreviousStatus: string = order.status;
    if (order.status === 'ON_HOLD') {
      const firstCharge = await this.prisma.orderExtraCharge.findFirst({
        where: { orderId, previousOrderStatus: { not: 'ON_HOLD' } },
        orderBy: { createdAt: 'asc' },
        select: { previousOrderStatus: true },
      });
      if (firstCharge?.previousOrderStatus) {
        savedPreviousStatus = firstCharge.previousOrderStatus;
      }
    }

    const charge = await this.prisma.orderExtraCharge.create({
      data: {
        orderId,
        chargeType: dto.chargeType,
        amount: new Decimal(dto.amount),
        currency: (dto.currency as any) ?? 'CNY',
        description: dto.description,
        imageUrls: dto.imageUrls ?? [],
        status: 'PENDING',
        previousOrderStatus: savedPreviousStatus,
        createdBy,
      },
    });

    // Put order ON_HOLD (skip if already ON_HOLD)
    // Use optimistic lock: only update if status hasn't changed since we read it
    if (order.status !== 'ON_HOLD') {
      const result = await this.prisma.order.updateMany({
        where: { id: orderId, status: order.status as any },
        data: { status: 'ON_HOLD' as any },
      });

      if (result.count === 0) {
        throw new ConflictException(
          `Order status changed concurrently (expected ${order.status}). Please refresh and try again.`,
        );
      }
    }

    this.eventEmitter.emit('order.extra_charge_pending', {
      chargeId: charge.id,
      orderId,
      orderCode: order.code,
      chargeType: dto.chargeType,
      amount: dto.amount,
      previousStatus: savedPreviousStatus,
      createdBy,
    });

    // Create approval request: WH VN Manager (24h) -> Chief Accountant (24h)
    await this.approvalService.createApprovalRequest(
      ApprovalType.EXTRA_CHARGE_APPROVAL,
      charge.id,
      createdBy,
      {
        referenceCode: order.code,
        requestData: {
          orderId,
          chargeType: dto.chargeType,
          amount: dto.amount,
          currency: dto.currency ?? 'CNY',
        },
      },
    );

    this.logger.log(
      `Extra charge added to order ${order.code}: ${dto.chargeType} = ${dto.amount} ${dto.currency ?? 'CNY'}. Order set to ON_HOLD.`,
    );

    return charge;
  }

  /**
   * Approve an extra charge.
   * Adds the charge amount to the order total and removes ON_HOLD status.
   */
  async approveExtraCharge(chargeId: string, userId: string) {
    const charge = await this.prisma.orderExtraCharge.findUnique({
      where: { id: chargeId },
      include: {
        order: { select: { id: true, code: true, totalAmount: true, status: true } },
      },
    });

    if (!charge) {
      throw new NotFoundException(`Extra charge with ID ${chargeId} not found`);
    }

    if (charge.status !== 'PENDING') {
      throw new BadRequestException(`Extra charge is already ${charge.status}`);
    }

    // Update charge status
    const updated = await this.prisma.orderExtraCharge.update({
      where: { id: chargeId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
      },
    });

    // Add charge amount to order total
    const newTotal = Number(charge.order.totalAmount) + Number(charge.amount);

    // Determine the correct status to restore when removing ON_HOLD
    let restoreStatus: string | undefined;
    if (await this.shouldRemoveHold(charge.orderId)) {
      restoreStatus = await this.getOriginalStatus(charge);
    }

    // Use optimistic lock when restoring status from ON_HOLD
    if (restoreStatus) {
      const result = await this.prisma.order.updateMany({
        where: { id: charge.orderId, status: 'ON_HOLD' as any },
        data: {
          totalAmount: new Decimal(newTotal),
          status: restoreStatus as any,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          `Order status changed concurrently (expected ON_HOLD). Please refresh and try again.`,
        );
      }
    } else {
      await this.prisma.order.update({
        where: { id: charge.orderId },
        data: {
          totalAmount: new Decimal(newTotal),
        },
      });
    }

    this.eventEmitter.emit('order.extra_charge_approved', {
      chargeId,
      orderId: charge.orderId,
      orderCode: charge.order.code,
      amount: Number(charge.amount),
      approvedBy: userId,
    });

    this.logger.log(
      `Extra charge ${chargeId} approved for order ${charge.order.code}. New total: ${newTotal}`,
    );

    return updated;
  }

  /**
   * Reject an extra charge.
   * Removes ON_HOLD status from the order.
   */
  async rejectExtraCharge(chargeId: string, userId: string) {
    const charge = await this.prisma.orderExtraCharge.findUnique({
      where: { id: chargeId },
      include: {
        order: { select: { id: true, code: true, status: true } },
      },
    });

    if (!charge) {
      throw new NotFoundException(`Extra charge with ID ${chargeId} not found`);
    }

    if (charge.status !== 'PENDING') {
      throw new BadRequestException(`Extra charge is already ${charge.status}`);
    }

    const updated = await this.prisma.orderExtraCharge.update({
      where: { id: chargeId },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
      },
    });

    // Remove ON_HOLD if no other pending charges — restore correct previous status
    // Use optimistic lock to ensure ON_HOLD hasn't been changed concurrently
    if (await this.shouldRemoveHold(charge.orderId)) {
      const restoreStatus = await this.getOriginalStatus(charge);
      const result = await this.prisma.order.updateMany({
        where: { id: charge.orderId, status: 'ON_HOLD' as any },
        data: { status: restoreStatus as any },
      });

      if (result.count === 0) {
        this.logger.warn(
          `Order ${charge.orderId} status was not ON_HOLD when trying to restore to ${restoreStatus}. ` +
            `Possible concurrent modification — skipping status restore.`,
        );
      }
    }

    this.eventEmitter.emit('order.extra_charge_rejected', {
      chargeId,
      orderId: charge.orderId,
      orderCode: charge.order.code,
      rejectedBy: userId,
    });

    this.logger.log(`Extra charge ${chargeId} rejected for order ${charge.order.code}`);

    return updated;
  }

  /**
   * Get all extra charges for an order.
   */
  async getExtraCharges(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const charges = await this.prisma.orderExtraCharge.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    // Join approval status for FE to show progress
    const chargeIds = charges.map((c) => c.id);
    const approvals = chargeIds.length
      ? await this.prisma.approval.findMany({
          where: {
            referenceId: { in: chargeIds },
            type: 'EXTRA_CHARGE_APPROVAL',
          },
          include: { steps: { orderBy: { stepNumber: 'asc' } } },
        })
      : [];

    return charges.map((c) => ({
      ...c,
      approval: approvals.find((a) => a.referenceId === c.id) ?? null,
    }));
  }

  /**
   * Check if the ON_HOLD status should be removed
   * (no more pending extra charges).
   */
  private async shouldRemoveHold(orderId: string): Promise<boolean> {
    const pendingCount = await this.prisma.orderExtraCharge.count({
      where: { orderId, status: 'PENDING' },
    });
    return pendingCount === 0;
  }

  /**
   * Get the original pre-ON_HOLD status from charge data.
   * If the charge's previousOrderStatus is ON_HOLD (edge case),
   * find the earliest charge that recorded the real status.
   */
  private async getOriginalStatus(charge: { orderId: string; previousOrderStatus: string | null; order: { status: string } }): Promise<string> {
    if (charge.previousOrderStatus && charge.previousOrderStatus !== 'ON_HOLD') {
      return charge.previousOrderStatus;
    }
    const firstCharge = await this.prisma.orderExtraCharge.findFirst({
      where: { orderId: charge.orderId, previousOrderStatus: { not: 'ON_HOLD' } },
      orderBy: { createdAt: 'asc' },
      select: { previousOrderStatus: true },
    });
    return firstCharge?.previousOrderStatus ?? charge.order.status;
  }
}
