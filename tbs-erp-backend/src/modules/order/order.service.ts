import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import {
  OrderStatus,
  ServiceType,
  ClearanceType,
  Prisma,
  CustomerTier,
  UserRole,
  Currency,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { DataScopeFilter } from '@common/guards/data-scope.guard';
import { OrderRepository, OrderWithRelations } from './order.repository';
import { OrderStatusMachine } from './domain/order-status.machine';
import { DepositGateService } from './domain/deposit-gate.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly statusMachine: OrderStatusMachine,
    private readonly depositGate: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Creates a new order.
   *
   * Validates the customer exists, calculates total amount from items,
   * determines deposit requirement based on customer tier and service type,
   * and creates the order with initial CONSULTING status.
   */
  async createOrder(dto: CreateOrderDto, currentUser: ICurrentUser) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: {
        id: true,
        code: true,
        fullName: true,
        tier: true,
        depositRate: true,
        isActive: true,
        exchangeRateMode: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found`,
      );
    }

    if (!customer.isActive) {
      throw new BadRequestException(
        `Customer ${customer.code} is inactive and cannot place orders`,
      );
    }

    // Calculate total amount from items
    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);

    // Calculate deposit requirement
    const depositReq = this.depositGate.checkDepositRequirement(
      totalAmount,
      customer.tier,
      dto.serviceType,
      customer.depositRate,
    );

    // Generate order code
    const code = await this.orderRepo.generateOrderCode();

    // Prepare order items
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = dto.items.map(
      (item) => ({
        productName: item.productName,
        productUrl: item.productUrl,
        quantity: item.quantity,
        unitPrice: new Decimal(item.unitPrice),
        currency: item.currency ?? 'CNY',
        totalPrice: new Decimal(item.quantity * item.unitPrice),
        note: item.note,
      }),
    );

    // Resolve exchange rate mode from customer settings
    let baseExchangeRate: Decimal | null = null;
    let exchangeRateMode: string = 'FLOATING';

    if (customer.exchangeRateMode === 'FIXED') {
      exchangeRateMode = 'FIXED';
      try {
        const currentRate = await this.exchangeRateService.getCurrentRate(
          Currency.CNY,
          Currency.VND,
        );
        baseExchangeRate = new Decimal(Number(currentRate.rate));
        this.logger.log(
          `Order ${code}: FIXED exchange rate locked at CNY/VND = ${currentRate.rate}`,
        );
      } catch (error) {
        this.logger.warn(
          `Order ${code}: Could not fetch CNY/VND rate for FIXED mode, proceeding without locked rate. Error: ${error.message}`,
        );
      }
    }

    // Create the order
    const order = await this.orderRepo.create(
      {
        code,
        customer: { connect: { id: dto.customerId } },
        saleId: currentUser.id,
        serviceType: dto.serviceType,
        branch: dto.branch,
        shippingRoute: dto.shippingRoute,
        status: OrderStatus.CONSULTING,
        totalAmount: new Decimal(totalAmount),
        depositRequired: new Decimal(depositReq.depositAmount),
        note: dto.note,
        exchangeRateMode,
        ...(baseExchangeRate !== null && { baseExchangeRate }),
      },
      items,
    );

    // Create initial status history
    await this.orderRepo.createStatusHistory({
      orderId: order.id,
      fromStatus: null,
      toStatus: OrderStatus.CONSULTING,
      changedBy: currentUser.id,
      note: 'Order created',
    });

    // Emit order created event
    this.eventEmitter.emit('order.created', {
      orderId: order.id,
      code: order.code,
      customerId: dto.customerId,
      serviceType: dto.serviceType,
      totalAmount,
      depositRequired: depositReq.depositAmount,
      createdBy: currentUser.id,
      exchangeRateMode,
      baseExchangeRate: baseExchangeRate ? Number(baseExchangeRate) : null,
    });

    this.logger.log(
      `Order ${code} created for customer ${customer.code} by user ${currentUser.id} (exchangeRateMode=${exchangeRateMode})`,
    );

    return order;
  }

  /**
   * Lists orders with pagination, filters, and data scope isolation.
   */
  async findAll(query: OrderQueryDto, dataScope?: DataScopeFilter) {
    const where: Prisma.OrderWhereInput = {};

    // Apply filters
    if (query.status) {
      where.status = query.status;
    }

    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.saleId) {
      where.saleId = query.saleId;
    }

    if (query.clearanceType) {
      where.clearanceType = query.clearanceType;
    }

    // Search by order code or customer name
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        {
          customer: {
            fullName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          customer: {
            companyName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    const { data, total } = await this.orderRepo.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.OrderOrderByWithRelationInput,
      dataScope,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single order by ID with full relations.
   * Optionally checks data scope for authorization.
   */
  async findById(id: string, dataScope?: DataScopeFilter): Promise<OrderWithRelations> {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Check data scope authorization
    if (dataScope && !dataScope.isGlobal) {
      if (dataScope.saleId && order.saleId !== dataScope.saleId) {
        throw new ForbiddenException('You do not have permission to access this order');
      }
      if (dataScope.branch && order.branch !== dataScope.branch) {
        throw new ForbiddenException('You do not have permission to access this order');
      }
    }

    return order;
  }

  /**
   * Updates an existing order.
   * Only allowed when the order is in CONSULTING or QUOTATION status.
   */
  async updateOrder(id: string, dto: UpdateOrderDto, currentUser: ICurrentUser) {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only allow edits in early stages
    const editableStatuses: OrderStatus[] = [
      OrderStatus.CONSULTING,
      OrderStatus.QUOTATION,
    ];

    if (!editableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order in status ${order.status} cannot be edited. ` +
          `Edits are only allowed in: ${editableStatuses.join(', ')}`,
      );
    }

    const updateData: Prisma.OrderUpdateInput = {};

    if (dto.serviceType !== undefined) {
      updateData.serviceType = dto.serviceType;
    }

    if (dto.branch !== undefined) {
      updateData.branch = dto.branch;
    }

    if (dto.shippingRoute !== undefined) {
      updateData.shippingRoute = dto.shippingRoute;
    }

    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }

    // If items are provided, replace all items and recalculate totals
    if (dto.items && dto.items.length > 0) {
      const newItems = dto.items.map((item) => ({
        productName: item.productName,
        productUrl: item.productUrl,
        quantity: item.quantity,
        unitPrice: new Decimal(item.unitPrice),
        currency: item.currency ?? 'CNY' as any,
        totalPrice: new Decimal(item.quantity * item.unitPrice),
        note: item.note,
      }));

      await this.orderRepo.replaceItems(id, newItems);

      // Recalculate total amount
      const totalAmount = dto.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      updateData.totalAmount = new Decimal(totalAmount);

      // Recalculate deposit if needed
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { tier: true, depositRate: true },
      });

      if (customer) {
        const serviceType =
          (dto.serviceType as ServiceType) ?? order.serviceType;
        const depositReq = this.depositGate.checkDepositRequirement(
          totalAmount,
          customer.tier,
          serviceType,
          customer.depositRate,
        );
        updateData.depositRequired = new Decimal(depositReq.depositAmount);
      }
    }

    const updated = await this.orderRepo.update(id, updateData);

    this.eventEmitter.emit('order.updated', {
      orderId: id,
      updatedBy: currentUser.id,
      changes: dto,
    });

    return updated;
  }

  /**
   * Changes the status of an order with FSM validation.
   *
   * Validates the transition using the state machine, checks deposit gate
   * for MHH orders, creates history record, and emits status change event.
   */
  async changeStatus(
    id: string,
    newStatus: OrderStatus,
    userId: string,
    note?: string,
  ) {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Validate FSM transition
    this.statusMachine.assertTransition(
      order.status,
      newStatus,
      order.serviceType,
    );

    // Check deposit gate for SOURCING transition
    const depositBlock = this.depositGate.shouldBlockTransition(
      order,
      newStatus,
    );

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
      const remainingAmount =
        Number(order.totalAmount) - Number(order.depositPaid);

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
      throw new BadRequestException(
        'Cancel reason must be at least 10 characters',
      );
    }

    // Calculate refund based on cancellation stage
    const cancellation = this.calculateCancellationRefund(order);

    // Determine approval steps based on stage
    const approvalSteps = this.getCancelApprovalSteps(cancellation.stage);

    // Stage 1-2 with no deposit: direct cancellation with Leader approval if high value
    const needsApproval =
      cancellation.stage !== 'BEFORE_DEPOSIT' ||
      Number(order.totalAmount) > 50_000_000;

    if (needsApproval) {
      // Create approval request with refund details
      const approval = await this.prisma.approval.create({
        data: {
          type: 'ORDER_CANCEL',
          referenceId: id,
          referenceCode: order.code,
          requestedBy: userId,
          requestData: {
            orderId: id,
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
          },
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
      await this.orderRepo.update(id, { cancelReason: reason });

      this.eventEmitter.emit('order.cancel.requested', {
        orderId: id,
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

    this.logger.log(
      `Order ${order.code} cancelled by ${userId}: ${reason}`,
    );

    return { status: 'CANCELLED', order: updated, cancellation };
  }

  /**
   * Calculate the refund amount based on the order's current stage.
   */
  private calculateCancellationRefund(order: OrderWithRelations) {
    const depositPaid = Number(order.depositPaid);
    const totalAmount = Number(order.totalAmount);
    const ADMIN_FEE_RATE = 0.02; // 2% admin fee

    // Stage 1-2: CONSULTING, QUOTATION — before deposit
    if (
      order.status === OrderStatus.CONSULTING ||
      order.status === OrderStatus.QUOTATION
    ) {
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
      const refundAmount = Math.max(
        0,
        depositPaid - costsIncurred - adminFee,
      );

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
      const totalFulfilled = items.reduce(
        (sum, i) => sum + i.fulfilledQuantity,
        0,
      );

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
}
