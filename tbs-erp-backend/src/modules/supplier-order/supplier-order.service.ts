import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupplierOrderStatus, Prisma } from '@prisma/client';
import {
  SupplierOrderRepository,
  SupplierOrderWithRelations,
} from './supplier-order.repository';
import { SupplierOrderStatusMachine } from './domain/supplier-order-status.machine';
import { DepositGateService } from '@modules/order/domain/deposit-gate.service';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { UpdateSupplierOrderDto } from './dto/update-supplier-order.dto';
import { SupplierOrderQueryDto } from './dto/supplier-order-query.dto';
import { RecordReceivedDto } from './dto/record-received.dto';

@Injectable()
export class SupplierOrderService {
  private readonly logger = new Logger(SupplierOrderService.name);

  constructor(
    private readonly supplierOrderRepo: SupplierOrderRepository,
    private readonly statusMachine: SupplierOrderStatusMachine,
    private readonly depositGateService: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Creates a new supplier order with auto-generated code.
   */
  async createSupplierOrder(dto: CreateSupplierOrderDto, userId: string) {
    // Enforce 70% deposit gate
    const gate = await this.depositGateService.canProcure(dto.orderId);
    if (!gate.allowed) {
      throw new ForbiddenException(
        `Chưa đủ 70% cọc để mua hàng. Hiện tại: ${gate.depositPaidPercent.toFixed(1)}%`,
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
      estimatedDelivery: dto.estimatedDelivery
        ? new Date(dto.estimatedDelivery)
        : undefined,
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

    this.logger.log(
      `Supplier order ${code} created for order ${dto.orderId} by user ${userId}`,
    );

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
  async updateSupplierOrder(
    id: string,
    dto: UpdateSupplierOrderDto,
    userId: string,
  ) {
    const supplierOrder = await this.supplierOrderRepo.findById(id);

    if (!supplierOrder) {
      throw new NotFoundException(`Supplier order with ID ${id} not found`);
    }

    // Layer 1C: Immutability after approval — only DRAFT is editable
    const editableStatuses: SupplierOrderStatus[] = [
      SupplierOrderStatus.DRAFT,
    ];

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

    this.logger.log(
      `Supplier order ${supplierOrder.code} updated by user ${userId}`,
    );

    return updated;
  }

  /**
   * Changes the status of a supplier order with FSM validation.
   *
   * Validates the transition using the status machine, sets relevant
   * timestamp fields based on the target status, and emits a status
   * change event.
   */
  async changeStatus(
    id: string,
    newStatus: SupplierOrderStatus,
    userId: string,
    note?: string,
  ) {
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

    const updated = await this.supplierOrderRepo.updateStatus(
      id,
      newStatus,
      additionalData,
    );

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
      throw new BadRequestException(
        'Bắt buộc đính kèm ảnh khi nhận hàng từ NCC',
      );
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
      dto.actualPriceCNY > Number(supplierOrder.quotedPriceCNY) * 1.10
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
        variancePercent: ((dto.actualPriceCNY - Number(supplierOrder.quotedPriceCNY)) / Number(supplierOrder.quotedPriceCNY)) * 100,
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
      (dto.quantityReceived !== undefined
        ? ` (qty: ${dto.quantityReceived})`
        : ''),
    );

    return updated;
  }

  /**
   * Gets all supplier orders for a given parent order.
   */
  async findByOrderId(orderId: string) {
    const { data, total } = await this.supplierOrderRepo.findAll(
      { orderId },
      0,
      100,
      { createdAt: 'desc' },
    );

    return { data, total };
  }
}
