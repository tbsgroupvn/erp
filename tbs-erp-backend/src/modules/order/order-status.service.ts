import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderRepository } from './order.repository';
import { OrderStatusMachine } from './domain/order-status.machine';
import { DepositGateService } from './domain/deposit-gate.service';

@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly statusMachine: OrderStatusMachine,
    private readonly depositGate: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Changes the status of an order with FSM validation.
   *
   * Validates the transition using the state machine, checks deposit gate
   * for MHH orders, creates history record, and emits status change event.
   */
  async changeStatus(id: string, newStatus: OrderStatus, userId: string, note?: string, userRole?: UserRole) {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Validate FSM transition
    this.statusMachine.assertTransition(order.status, newStatus, order.serviceType);

    // KPI protection: restrict certain transitions to specific roles
    // SOURCING = deposit confirmed by accountant (prevent Sale from self-promoting)
    // COMPLETED = delivery confirmed by warehouse/logistics
    const RESTRICTED_TRANSITIONS: Partial<Record<OrderStatus, UserRole[]>> = {
      [OrderStatus.SOURCING]: [
        UserRole.CHIEF_ACCOUNTANT,
        UserRole.ACCOUNTANT,
        UserRole.ACCOUNTANT_AR,
        UserRole.CEO,
        UserRole.COO,
        UserRole.CFO,
      ],
      [OrderStatus.COMPLETED]: [
        UserRole.WAREHOUSE_VN_MANAGER,
        UserRole.WAREHOUSE_VN_STAFF,
        UserRole.LOGISTICS_MANAGER,
        UserRole.CEO,
        UserRole.COO,
      ],
    };

    const allowedRoles = RESTRICTED_TRANSITIONS[newStatus];
    if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role ${userRole} khong duoc phep chuyen sang trang thai ${newStatus}`,
      );
    }

    // Check deposit gate for SOURCING transition
    const depositBlock = this.depositGate.shouldBlockTransition(order, newStatus);

    if (depositBlock.blocked) {
      throw new BadRequestException(depositBlock.reason);
    }

    // Prepare additional data for specific transitions
    const additionalData: Prisma.OrderUpdateInput = {};

    if (newStatus === OrderStatus.COMPLETED) {
      additionalData.completedAt = new Date();
    }

    // Perform the status update
    const updated = await this.orderRepo.updateStatus(
      id,
      order.status,
      newStatus,
      userId,
      note,
      additionalData,
    );

    // Emit status change event
    this.eventEmitter.emit('order.status.changed', {
      orderId: id,
      code: order.code,
      customerId: order.customerId,
      fromStatus: order.status,
      toStatus: newStatus,
      changedBy: userId,
      serviceType: order.serviceType,
    });

    // When order moves to SOURCING, it means deposit is satisfied and order is confirmed.
    // Emit order.confirmed so AR module creates a receivable for the remaining balance.
    if (newStatus === OrderStatus.SOURCING) {
      const remainingAmount = Number(order.totalAmount) - Number(order.depositPaid);

      if (remainingAmount > 0) {
        this.eventEmitter.emit('order.confirmed', {
          orderId: id,
          customerId: order.customerId,
          totalAmount: remainingAmount,
          createdBy: userId,
        });

        this.logger.log(
          `Order ${order.code} confirmed: AR created for remaining ${remainingAmount} VND`,
        );
      }
    }

    this.logger.log(
      `Order ${order.code} status changed: ${order.status} -> ${newStatus} by ${userId}`,
    );

    return updated;
  }

  /**
   * Update deposit payment information for an order.
   * Called when a payment is received against the order's deposit.
   */
  async updateDepositPayment(orderId: string, amount: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        depositRequired: true,
        depositPaid: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const newDepositPaid = Number(order.depositPaid) + amount;
    const isDepositPaid = newDepositPaid >= Number(order.depositRequired);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        depositPaid: new Decimal(newDepositPaid),
        isDepositPaid,
      },
    });

    this.logger.log(
      `Order ${orderId}: deposit updated +${amount}, total paid=${newDepositPaid}, satisfied=${isDepositPaid}`,
    );

    return { orderId, depositPaid: newDepositPaid, isDepositPaid };
  }

  /**
   * B6: Updates the fulfillment status of an order based on delivered packages.
   *
   * - FULL: all packages have deliveredAt set
   * - PARTIAL: some packages delivered, but not all
   * - NONE: no packages delivered
   *
   * Falls back to item-based fulfillment if no packages exist.
   */
  async updateFulfillmentStatus(orderId: string) {
    // B6: Package-based fulfillment
    const totalPackages = await this.prisma.package.count({
      where: { orderId },
    });

    const deliveredPackages = await this.prisma.package.count({
      where: { orderId, deliveredAt: { not: null } },
    });

    let fulfillmentStatus: string;

    if (totalPackages === 0) {
      // Fall back to item-based fulfillment if no packages exist
      const items = await this.prisma.orderItem.findMany({
        where: { orderId },
        select: { quantity: true, fulfilledQuantity: true },
      });

      if (items.length === 0) return;

      const totalOrdered = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalFulfilled = items.reduce((sum, i) => sum + i.fulfilledQuantity, 0);

      if (totalFulfilled === 0) {
        fulfillmentStatus = 'NONE';
      } else if (totalFulfilled >= totalOrdered) {
        fulfillmentStatus = 'FULL';
      } else {
        fulfillmentStatus = 'PARTIAL';
      }
    } else {
      if (deliveredPackages === 0) {
        fulfillmentStatus = 'NONE';
      } else if (deliveredPackages >= totalPackages) {
        fulfillmentStatus = 'FULL';
      } else {
        fulfillmentStatus = 'PARTIAL';
      }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus },
    });

    this.logger.log(
      `Order ${orderId}: fulfillment status updated to ${fulfillmentStatus} ` +
        `(${deliveredPackages}/${totalPackages} packages delivered)`,
    );

    return { orderId, fulfillmentStatus, totalPackages, deliveredPackages };
  }

  /**
   * Adjusts an order item's quantity and recalculates order totalAmount.
   *
   * Used when MHH Issue resolution requires cancelling defective items.
   * Emits 'order.amount.adjusted' event for downstream commission recalculation.
   */
  async adjustOrderItemQuantity(
    orderId: string,
    orderItemId: string,
    newQuantity: number,
    reason: string,
    triggeredBy: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, totalAmount: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, orderId },
      select: { id: true, quantity: true, unitPrice: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`OrderItem ${orderItemId} not found in order ${orderId}`);
    }

    if (newQuantity < 0) {
      throw new BadRequestException('New quantity cannot be negative');
    }

    if (newQuantity >= orderItem.quantity) {
      throw new BadRequestException(
        `New quantity (${newQuantity}) must be less than current quantity (${orderItem.quantity})`,
      );
    }

    const newTotalPrice = new Decimal(newQuantity).mul(orderItem.unitPrice);

    // Update the order item
    await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        quantity: newQuantity,
        totalPrice: newTotalPrice,
      },
    });

    // Recalculate order totalAmount from all items
    const allItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { totalPrice: true },
    });

    const newOrderTotal = allItems.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Decimal(0),
    );

    const previousAmount = Number(order.totalAmount);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { totalAmount: newOrderTotal },
    });

    const newAmount = Number(newOrderTotal);

    this.eventEmitter.emit('order.amount.adjusted', {
      orderId,
      orderCode: order.code,
      previousAmount,
      newAmount,
      deltaAmount: newAmount - previousAmount,
      reason,
      triggeredBy,
      orderItemId,
    });

    this.logger.log(
      `Order ${order.code} item ${orderItemId} quantity adjusted: ` +
        `qty ${orderItem.quantity} -> ${newQuantity}, ` +
        `totalAmount ${previousAmount} -> ${newAmount} VND. Reason: ${reason}`,
    );

    return { orderId, orderItemId, previousAmount, newAmount };
  }

  /**
   * Update total weight fields for an order based on its packages.
   */
  async recalculateOrderWeights(orderId: string) {
    const packages = await this.prisma.package.findMany({
      where: { orderId },
      select: { actualWeight: true, chargeableWeight: true },
    });

    const totalActualWeight = packages.reduce(
      (sum, p) => sum + (p.actualWeight ? Number(p.actualWeight) : 0),
      0,
    );

    const totalChargeableWeight = packages.reduce(
      (sum, p) => sum + (p.chargeableWeight ? Number(p.chargeableWeight) : 0),
      0,
    );

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        totalActualWeight: new Decimal(totalActualWeight),
        totalChargeableWeight: new Decimal(totalChargeableWeight),
      },
    });

    this.logger.log(
      `Order ${orderId}: weights recalculated — actual=${totalActualWeight}kg, chargeable=${totalChargeableWeight}kg`,
    );
  }

  /**
   * Auto-transitions an order from SOURCING to WAREHOUSE_CN
   * when the first package is received at the CN warehouse.
   *
   * Called by WarehouseUpdatedListener, not by a user action.
   * Skips KPI role checks and deposit gate because the order
   * is already past SOURCING (deposit was already verified).
   *
   * Idempotent: if the order is already at WAREHOUSE_CN or beyond, no-ops.
   */
  async autoTransitionToWarehouseCN(orderId: string): Promise<boolean> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      this.logger.warn(`autoTransitionToWarehouseCN: Order ${orderId} not found`);
      return false;
    }

    if (order.status !== OrderStatus.SOURCING) {
      this.logger.debug(
        `autoTransitionToWarehouseCN: Order ${order.code} is ${order.status}, not SOURCING. Skipping.`,
      );
      return false;
    }

    if (!this.statusMachine.validateTransition(order.status, OrderStatus.WAREHOUSE_CN, order.serviceType)) {
      this.logger.warn(
        `autoTransitionToWarehouseCN: FSM rejected SOURCING -> WAREHOUSE_CN for order ${order.code}`,
      );
      return false;
    }

    try {
      await this.orderRepo.updateStatus(
        orderId,
        order.status,
        OrderStatus.WAREHOUSE_CN,
        'SYSTEM',
        'Tu dong chuyen trang thai: kien hang dau tien da nhap kho TQ',
      );

      this.eventEmitter.emit('order.status.changed', {
        orderId,
        code: order.code,
        customerId: order.customerId,
        fromStatus: OrderStatus.SOURCING,
        toStatus: OrderStatus.WAREHOUSE_CN,
        changedBy: 'SYSTEM',
        serviceType: order.serviceType,
      });

      this.logger.log(
        `Order ${order.code} auto-transitioned: SOURCING -> WAREHOUSE_CN (first package received at CN)`,
      );

      return true;
    } catch (error) {
      this.logger.warn(
        `autoTransitionToWarehouseCN: Failed for order ${order.code}: ${error.message}`,
      );
      return false;
    }
  }
}
