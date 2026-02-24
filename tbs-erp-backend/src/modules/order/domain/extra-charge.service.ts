import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
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
  ) {}

  /**
   * Add an extra charge to an order.
   * Sets charge status to PENDING and puts the order ON_HOLD.
   */
  async addExtraCharge(
    orderId: string,
    dto: AddExtraChargeDto,
    createdBy: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
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
        createdBy,
      },
    });

    // Put order ON_HOLD
    const previousStatus = order.status;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'ON_HOLD' as any },
    });

    this.eventEmitter.emit('order.extra_charge_pending', {
      chargeId: charge.id,
      orderId,
      orderCode: order.code,
      chargeType: dto.chargeType,
      amount: dto.amount,
      previousStatus,
      createdBy,
    });

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
      throw new BadRequestException(
        `Extra charge is already ${charge.status}`,
      );
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
    await this.prisma.order.update({
      where: { id: charge.orderId },
      data: {
        totalAmount: new Decimal(newTotal),
        // Remove ON_HOLD if no other pending charges
        ...(await this.shouldRemoveHold(charge.orderId)
          ? { status: 'WAREHOUSE_CN' as any }
          : {}),
      },
    });

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
      throw new BadRequestException(
        `Extra charge is already ${charge.status}`,
      );
    }

    const updated = await this.prisma.orderExtraCharge.update({
      where: { id: chargeId },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
      },
    });

    // Remove ON_HOLD if no other pending charges
    if (await this.shouldRemoveHold(charge.orderId)) {
      await this.prisma.order.update({
        where: { id: charge.orderId },
        data: { status: 'WAREHOUSE_CN' as any },
      });
    }

    this.eventEmitter.emit('order.extra_charge_rejected', {
      chargeId,
      orderId: charge.orderId,
      orderCode: charge.order.code,
      rejectedBy: userId,
    });

    this.logger.log(
      `Extra charge ${chargeId} rejected for order ${charge.order.code}`,
    );

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

    return this.prisma.orderExtraCharge.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
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
}
