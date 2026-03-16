import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupplierOrderStatus, Prisma, Currency } from '@prisma/client';
import { SupplierOrderRepository, SupplierOrderWithRelations } from './supplier-order.repository';
import { SupplierOrderStatusMachine } from './domain/supplier-order-status.machine';
import { DepositGateService } from '@modules/order/domain/deposit-gate.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { PrismaService } from '@core/database/prisma.service';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { UpdateSupplierOrderDto } from './dto/update-supplier-order.dto';
import { SupplierOrderQueryDto } from './dto/supplier-order-query.dto';
import { RecordReceivedDto } from './dto/record-received.dto';
import { CloseShortfallDto } from './dto/close-shortfall.dto';
import { RecordSupplierRefundDto } from './dto/record-supplier-refund.dto';

@Injectable()
export class SupplierOrderService {
  private readonly logger = new Logger(SupplierOrderService.name);

  constructor(
    private readonly supplierOrderRepo: SupplierOrderRepository,
    private readonly statusMachine: SupplierOrderStatusMachine,
    private readonly depositGateService: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates a new supplier order with auto-generated code.
   */
  async createSupplierOrder(dto: CreateSupplierOrderDto, userId: string) {
    // Enforce deposit gate (tier-based: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%)
    const gate = await this.depositGateService.canProcure(dto.orderId);
    if (!gate.allowed) {
      const shortfall = gate.totalAmount * gate.requiredPercent / 100 - gate.depositPaid;
      throw new ForbiddenException(
        `Chưa đủ ${gate.requiredPercent}% cọc để mua hàng. Hiện tại: ${gate.depositPaidPercent.toFixed(1)}%. Thiếu ${Math.ceil(shortfall).toLocaleString('vi-VN')} VND`,
      );
    }

    const code = await this.supplierOrderRepo.generateCode();

    const data: Prisma.SupplierOrderCreateInput = {
      code,
      order: { connect: { id: dto.orderId } },
      status: SupplierOrderStatus.DRAFT,
      supplierName: dto.supplierName,
      supplierPlatform: dto.supplierPlatform,
      supplierOrderNumber: dto.supplierOrderNumber,
      supplierUrl: dto.supplierUrl,
      quotedPriceCNY: dto.quotedPriceCNY,
      shippingFeeCNY: dto.shippingFeeCNY,
      quantityOrdered: dto.quantityOrdered,
      estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
      note: dto.note,
      internalNote: dto.internalNote,
      attachments: dto.attachments,
      createdBy: userId,
    };

    if (dto.orderItemId) {
      data.orderItem = { connect: { id: dto.orderItemId } };
    }

    if (dto.vendorId) {
      data.vendor = { connect: { id: dto.vendorId } };
    }

    const supplierOrder = await this.supplierOrderRepo.create(data, userId);

    this.eventEmitter.emit('supplier-order.created', {
      supplierOrderId: supplierOrder.id,
      code: supplierOrder.code,
      orderId: dto.orderId,
      supplierName: dto.supplierName,
      createdBy: userId,
      isPriority: gate.isPriority,
    });

    this.logger.log(`Supplier order ${code} created for order ${dto.orderId} by user ${userId}`);

    return supplierOrder;
  }

  /**
   * Lists supplier orders with pagination and filters.
   */
  async findAll(query: SupplierOrderQueryDto) {
    const where: Prisma.SupplierOrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    // Search by supplier order code, supplier name, or supplier order number
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { supplierOrderNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Date range filter on createdAt
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

    const { data, total } = await this.supplierOrderRepo.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.SupplierOrderOrderByWithRelationInput,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single supplier order by ID with full relations.
   */
  async findById(id: string): Promise<SupplierOrderWithRelations> {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    return supplierOrder;
  }

  /**
   * Updates an existing supplier order.
   * Only allowed when the order is in DRAFT or QUOTED status.
   */
  async updateSupplierOrder(id: string, dto: UpdateSupplierOrderDto, userId: string) {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    // Layer 1C: Immutability after approval — only DRAFT is editable
    const editableStatuses: SupplierOrderStatus[] = [SupplierOrderStatus.DRAFT];

    if (!editableStatuses.includes(supplierOrder.status)) {
      throw new BadRequestException(
        `Đơn NCC ${supplierOrder.code} ở trạng thái ${supplierOrder.status} không thể chỉnh sửa. ` +
          `Chỉ cho phép sửa khi: ${editableStatuses.join(', ')}`,
      );
    }

    const updateData: Prisma.SupplierOrderUpdateInput = {};

    if (dto.supplierName !== undefined) {
      updateData.supplierName = dto.supplierName;
    }

    if (dto.supplierPlatform !== undefined) {
      updateData.supplierPlatform = dto.supplierPlatform;
    }

    if (dto.supplierOrderNumber !== undefined) {
      updateData.supplierOrderNumber = dto.supplierOrderNumber;
    }

    if (dto.supplierUrl !== undefined) {
      updateData.supplierUrl = dto.supplierUrl;
    }

    if (dto.quotedPriceCNY !== undefined) {
      updateData.quotedPriceCNY = dto.quotedPriceCNY;
    }

    if (dto.shippingFeeCNY !== undefined) {
      updateData.shippingFeeCNY = dto.shippingFeeCNY;
    }

    if (dto.quantityOrdered !== undefined) {
      updateData.quantityOrdered = dto.quantityOrdered;
    }

    if (dto.estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = new Date(dto.estimatedDelivery);
    }

    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }

    if (dto.internalNote !== undefined) {
      updateData.internalNote = dto.internalNote;
    }

    if (dto.attachments !== undefined) {
      updateData.attachments = dto.attachments;
    }

    if (dto.vendorId !== undefined) {
      updateData.vendor = { connect: { id: dto.vendorId } };
    }

    if (dto.orderItemId !== undefined) {
      updateData.orderItem = dto.orderItemId
        ? { connect: { id: dto.orderItemId } }
        : { disconnect: true };
    }

    const updated = await this.supplierOrderRepo.update(id, updateData);

    this.eventEmitter.emit('supplier-order.updated', {
      supplierOrderId: id,
      code: supplierOrder.code,
      updatedBy: userId,
      changes: dto,
    });

    this.logger.log(`Supplier order ${supplierOrder.code} updated by user ${userId}`);

    return updated;
  }

  /**
   * Changes the status of a supplier order with FSM validation.
   *
   * Validates the transition using the status machine, sets relevant
   * timestamp fields based on the target status, and emits a status
   * change event.
   */
  async changeStatus(id: string, newStatus: SupplierOrderStatus, userId: string, note?: string) {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    // Validate FSM transition
    this.statusMachine.assertTransition(supplierOrder.status, newStatus);

    // Prepare additional data based on target status
    const additionalData: Prisma.SupplierOrderUpdateInput = {};

    if (note) {
      additionalData.note = note;
    }

    // Set timestamps based on target status
    switch (newStatus) {
      case SupplierOrderStatus.ORDERED:
        additionalData.orderedAt = new Date();
        break;
      case SupplierOrderStatus.CONFIRMED:
        additionalData.confirmedAt = new Date();
        break;
      case SupplierOrderStatus.PARTIALLY_SHIPPED:
      case SupplierOrderStatus.SHIPPED_CN:
        additionalData.shippedAt = new Date();
        break;
      case SupplierOrderStatus.RECEIVED_CN:
        additionalData.receivedAt = new Date();
        additionalData.actualDelivery = new Date();
        break;
      case SupplierOrderStatus.CANCELLED:
        additionalData.cancelledAt = new Date();
        break;
    }

    const updated = await this.supplierOrderRepo.updateStatus(id, newStatus, additionalData);

    this.eventEmitter.emit('supplier-order.status.changed', {
      supplierOrderId: id,
      code: supplierOrder.code,
      orderId: supplierOrder.orderId,
      fromStatus: supplierOrder.status,
      toStatus: newStatus,
      changedBy: userId,
    });

    this.logger.log(
      `Supplier order ${supplierOrder.code} status changed: ${supplierOrder.status} -> ${newStatus} by ${userId}`,
    );

    return updated;
  }

  /**
   * Records receipt of goods at the CN warehouse from the supplier.
   *
   * Updates quantity received, actual price, and transitions the status
   * to RECEIVED_CN. If quantity received is less than ordered, the status
   * moves to PARTIALLY_SHIPPED instead and an ISSUE note may be added.
   */
  async recordReceived(id: string, dto: RecordReceivedDto, userId: string) {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    // D4: Mandatory photos when receiving goods from supplier
    if (!dto.attachments || dto.attachments.length === 0) {
      throw new BadRequestException('Bắt buộc đính kèm ảnh khi nhận hàng từ NCC');
    }

    // Validate that we can transition to RECEIVED_CN from the current status
    const allowedStatuses: SupplierOrderStatus[] = [
      SupplierOrderStatus.SHIPPED_CN,
      SupplierOrderStatus.PARTIALLY_SHIPPED,
      SupplierOrderStatus.CONFIRMED,
      SupplierOrderStatus.ORDERED,
    ];

    if (!allowedStatuses.includes(supplierOrder.status)) {
      throw new BadRequestException(
        `Cannot record receipt for supplier order in status ${supplierOrder.status}. ` +
          `Allowed statuses: ${allowedStatuses.join(', ')}`,
      );
    }

    // Validate quantityReceived does not exceed quantityOrdered
    if (
      dto.quantityReceived !== undefined &&
      supplierOrder.quantityOrdered !== null &&
      dto.quantityReceived > supplierOrder.quantityOrdered
    ) {
      throw new BadRequestException(
        `Quantity received (${dto.quantityReceived}) cannot exceed quantity ordered (${supplierOrder.quantityOrdered})`,
      );
    }

    // Determine target status: partial or full receipt
    const isPartialReceipt =
      dto.quantityReceived !== undefined &&
      supplierOrder.quantityOrdered !== null &&
      dto.quantityReceived < supplierOrder.quantityOrdered;

    const updateData: Prisma.SupplierOrderUpdateInput = {
      status: isPartialReceipt
        ? SupplierOrderStatus.PARTIALLY_SHIPPED
        : SupplierOrderStatus.RECEIVED_CN,
      receivedAt: new Date(),
      actualDelivery: new Date(),
    };

    if (dto.quantityReceived !== undefined) {
      updateData.quantityReceived = dto.quantityReceived;
    }

    if (dto.actualPriceCNY !== undefined) {
      updateData.actualPriceCNY = dto.actualPriceCNY;
    }

    if (dto.note) {
      updateData.note = supplierOrder.note
        ? `${supplierOrder.note}\nReceived: ${dto.note}`
        : `Received: ${dto.note}`;
    }

    if (dto.attachments && dto.attachments.length > 0) {
      const existingAttachments = (supplierOrder.attachments as string[]) ?? [];
      updateData.attachments = [...existingAttachments, ...dto.attachments];
    }

    const updated = await this.supplierOrderRepo.update(id, updateData);

    // D3: Warn if actual price exceeds quoted price by more than 10%
    if (
      dto.actualPriceCNY !== undefined &&
      supplierOrder.quotedPriceCNY !== null &&
      Number(supplierOrder.quotedPriceCNY) > 0 &&
      dto.actualPriceCNY > Number(supplierOrder.quotedPriceCNY) * 1.1
    ) {
      this.logger.warn(
        `Price variance on ${supplierOrder.code}: actual ${dto.actualPriceCNY} CNY > quoted ${supplierOrder.quotedPriceCNY} CNY (+10% threshold)`,
      );
      this.eventEmitter.emit('supplier-order.price-variance', {
        supplierOrderId: id,
        code: supplierOrder.code,
        orderId: supplierOrder.orderId,
        quotedPriceCNY: Number(supplierOrder.quotedPriceCNY),
        actualPriceCNY: dto.actualPriceCNY,
        variancePercent:
          ((dto.actualPriceCNY - Number(supplierOrder.quotedPriceCNY)) /
            Number(supplierOrder.quotedPriceCNY)) *
          100,
      });
    }

    this.eventEmitter.emit('supplier-order.received', {
      supplierOrderId: id,
      code: supplierOrder.code,
      orderId: supplierOrder.orderId,
      quantityReceived: dto.quantityReceived,
      actualPriceCNY: dto.actualPriceCNY,
      receivedBy: userId,
    });

    this.logger.log(
      `Supplier order ${supplierOrder.code} received at CN warehouse by ${userId}` +
        (dto.quantityReceived !== undefined ? ` (qty: ${dto.quantityReceived})` : ''),
    );

    return updated;
  }

  /**
   * Closes a shortfall on a partially-shipped supplier order.
   *
   * Transitions the SO to RECEIVED_CN and records the shortfall details.
   * Emits `supplier-order.shortfall.closed` for downstream listeners
   * (wallet credit, fulfillment tracking).
   */
  async closeShortfall(id: string, dto: CloseShortfallDto, userId: string) {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    // Only PARTIALLY_SHIPPED orders can close shortfall
    if (supplierOrder.status !== SupplierOrderStatus.PARTIALLY_SHIPPED) {
      throw new BadRequestException(
        `Chi co the dong thieu hang khi trang thai la PARTIALLY_SHIPPED. ` +
          `Trang thai hien tai: ${supplierOrder.status}`,
      );
    }

    const shortfallQty = supplierOrder.quantityOrdered - supplierOrder.quantityReceived;
    if (shortfallQty <= 0) {
      throw new BadRequestException(
        `Khong co thieu hang. quantityOrdered=${supplierOrder.quantityOrdered}, ` +
          `quantityReceived=${supplierOrder.quantityReceived}`,
      );
    }

    // Validate FSM transition: PARTIALLY_SHIPPED -> RECEIVED_CN
    this.statusMachine.assertTransition(
      supplierOrder.status,
      SupplierOrderStatus.RECEIVED_CN,
    );

    const existingAttachments = (supplierOrder.attachments as string[]) ?? [];

    const updateData: Prisma.SupplierOrderUpdateInput = {
      status: SupplierOrderStatus.RECEIVED_CN,
      shortfallReason: dto.shortfallReason,
      supplierRefundCNY: dto.supplierRefundCNY,
      shortfallClosedAt: new Date(),
      shortfallClosedBy: userId,
      receivedAt: new Date(),
      actualDelivery: new Date(),
      attachments: [...existingAttachments, ...dto.attachments],
    };

    if (dto.note) {
      updateData.note = supplierOrder.note
        ? `${supplierOrder.note}\nShortfall: ${dto.note}`
        : `Shortfall: ${dto.note}`;
    }

    const updated = await this.supplierOrderRepo.update(id, updateData);

    this.eventEmitter.emit('supplier-order.shortfall.closed', {
      supplierOrderId: id,
      code: supplierOrder.code,
      orderId: supplierOrder.orderId,
      orderItemId: supplierOrder.orderItemId,
      shortfallQty,
      quantityOrdered: supplierOrder.quantityOrdered,
      quantityReceived: supplierOrder.quantityReceived,
      supplierRefundCNY: dto.supplierRefundCNY,
      closedBy: userId,
    });

    this.logger.log(
      `Supplier order ${supplierOrder.code} shortfall closed: ` +
        `${shortfallQty} units short, refund ${dto.supplierRefundCNY} CNY, by ${userId}`,
    );

    return updated;
  }

  /**
   * Gets all supplier orders for a given parent order.
   */
  async findByOrderId(orderId: string) {
    const { data, total } = await this.supplierOrderRepo.findAll({ orderId }, 0, 100, {
      createdAt: 'desc',
    });

    return { data, total };
  }

  /**
   * Records a supplier refund (independent of shortfall closure).
   * Converts CNY to VND using FIXED or FLOATING exchange rate,
   * credits the customer's wallet, and emits event for auto-clear AR.
   */
  async recordSupplierRefund(dto: RecordSupplierRefundDto, userId: string) {
    // Validate supplier order exists
    const supplierOrder = await this.supplierOrderRepo.findById(dto.supplierOrderId);
    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order ${dto.supplierOrderId} not found`);
    }

    // Validate order belongs to the customer
    const order = await this.prisma.order.findUnique({
      where: { id: supplierOrder.orderId },
      select: {
        id: true,
        code: true,
        customerId: true,
        baseExchangeRate: true,
        exchangeRateMode: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${supplierOrder.orderId} not found`);
    }

    if (order.customerId !== dto.customerId) {
      throw new BadRequestException(
        `Order ${order.code} does not belong to customer ${dto.customerId}`,
      );
    }

    // Determine exchange rate: FIXED uses order's baseExchangeRate, FLOATING uses current rate
    let exchangeRate: number;

    if (order.exchangeRateMode === 'FIXED' && order.baseExchangeRate) {
      exchangeRate = Number(order.baseExchangeRate);
    } else {
      const rate = await this.exchangeRateService.getCurrentRate(Currency.CNY, Currency.VND);
      exchangeRate = Number(rate.rate);
    }

    const refundVND = Math.round(dto.refundAmountCNY * exchangeRate * 100) / 100;

    // Credit wallet
    const note =
      `Hoan tien NCC: ${dto.reason} - ${supplierOrder.code}` +
      (dto.note ? ` | ${dto.note}` : '');

    const refundResult = await this.walletService.refund(
      dto.customerId,
      refundVND,
      supplierOrder.code,
      note,
    );

    this.logger.log(
      `Supplier refund recorded: ${supplierOrder.code}, ` +
        `${dto.refundAmountCNY} CNY * ${exchangeRate} = ${refundVND} VND, ` +
        `customer=${dto.customerId}, by=${userId}`,
    );

    // Emit event for AutoClearArListener
    this.eventEmitter.emit('wallet.credited.supplier-refund', {
      customerId: dto.customerId,
      amount: refundVND,
      newBalance: refundResult.wallet.balance.toNumber(),
      source: 'SUPPLIER_REFUND',
      supplierOrderCode: supplierOrder.code,
      transactionId: refundResult.transaction.id,
    });

    return {
      supplierOrderCode: supplierOrder.code,
      orderCode: order.code,
      refundAmountCNY: dto.refundAmountCNY,
      exchangeRate,
      refundAmountVND: refundVND,
      walletBalance: refundResult.wallet.balance.toNumber(),
      transactionId: refundResult.transaction.id,
    };
  }
}
