import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, MasterOrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { DataScopeFilter } from '@common/guards/data-scope.guard';
import { EXECUTIVE_ROLES } from '@core/rbac/roles.enum';
import { MasterOrderRepository, MasterOrderWithRelations } from './master-order.repository';
import { OrderRepository } from './order.repository';
import { DepositGateService } from './domain/deposit-gate.service';
import { CreateMasterOrderDto, CreateSubOrderDto } from './dto/create-master-order.dto';
import { MasterOrderQueryDto } from './dto/master-order-query.dto';

@Injectable()
export class MasterOrderService {
  private readonly logger = new Logger(MasterOrderService.name);

  constructor(
    private readonly masterOrderRepo: MasterOrderRepository,
    private readonly orderRepo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly depositGate: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a master order with sub orders.
   * Uses a transaction for atomicity and retry logic for code generation race conditions.
   */
  async createMasterOrder(dto: CreateMasterOrderDto, currentUser: ICurrentUser) {
    // Lookup user.saleCode
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, saleCode: true },
    });

    const isExec = EXECUTIVE_ROLES.includes(currentUser.role);

    if (!user?.saleCode && !isExec) {
      throw new BadRequestException(
        'User does not have a saleCode assigned. Please contact admin to set your saleCode.',
      );
    }

    // Validate customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: {
        id: true,
        code: true,
        fullName: true,
        tier: true,
        depositRate: true,
        isActive: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    if (!customer.isActive) {
      throw new BadRequestException(
        `Customer ${customer.code} is inactive and cannot place orders`,
      );
    }

    // Retry loop for code generation race condition (unique constraint)
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Generate master order code inside the attempt loop
        const effectiveSaleCode = user?.saleCode || 'BOD';
        const masterCode = await this.masterOrderRepo.generateMasterOrderCode(effectiveSaleCode);

        // Create master order and sub orders in a transaction
        const result = await this.prisma.$transaction(async (tx) => {
          // Create master order
          const masterOrder = await tx.masterOrder.create({
            data: {
              code: masterCode,
              customerId: dto.customerId,
              saleId: currentUser.id,
              branch: dto.branch,
              overallStatus: MasterOrderStatus.ACTIVE,
              note: dto.note,
            },
          });

          // Create sub orders
          const subOrders = [];
          for (let i = 0; i < dto.subOrders.length; i++) {
            const subDto = dto.subOrders[i];
            const suffix = this.masterOrderRepo.getSubOrderSuffix(i);
            const subCode = this.masterOrderRepo.generateSubOrderCode(masterCode, i);

            // Calculate total amount from items using Decimal for precision
            const totalAmount = subDto.items.reduce(
              (sum, item) => sum.add(new Decimal(item.quantity).mul(new Decimal(item.unitPrice))),
              new Decimal(0),
            );

            // Calculate deposit requirement
            const depositReq = this.depositGate.checkDepositRequirement(
              totalAmount.toNumber(),
              customer.tier,
              subDto.serviceType,
              customer.depositRate,
            );

            // Create the sub order
            const subOrder = await tx.order.create({
              data: {
                code: subCode,
                customerId: dto.customerId,
                saleId: currentUser.id,
                serviceType: subDto.serviceType,
                status: OrderStatus.CONSULTING,
                branch: dto.branch,
                shippingRoute: subDto.shippingRoute,
                totalAmount,
                depositRequired: new Decimal(depositReq.depositAmount),
                masterOrderId: masterOrder.id,
                subOrderSuffix: suffix,
                clearanceType: subDto.clearanceType,
                note: subDto.note,
                items: {
                  create: subDto.items.map((item) => ({
                    productName: item.productName,
                    productUrl: item.productUrl,
                    quantity: item.quantity,
                    unitPrice: new Decimal(item.unitPrice),
                    currency: item.currency ?? 'CNY',
                    totalPrice: new Decimal(item.quantity).mul(new Decimal(item.unitPrice)),
                    note: item.note,
                  })),
                },
              },
              include: {
                items: true,
              },
            });

            // Create initial status history
            await tx.orderStatusHistory.create({
              data: {
                orderId: subOrder.id,
                fromStatus: null,
                toStatus: OrderStatus.CONSULTING,
                changedBy: currentUser.id,
                note: 'Sub order created',
              },
            });

            subOrders.push(subOrder);
          }

          return { masterOrder, subOrders };
        });

        // Emit events
        this.eventEmitter.emit('master-order.created', {
          masterOrderId: result.masterOrder.id,
          code: masterCode,
          customerId: dto.customerId,
          subOrderCount: dto.subOrders.length,
          createdBy: currentUser.id,
        });

        this.logger.log(
          `Master order ${masterCode} created with ${dto.subOrders.length} sub orders by ${currentUser.id}`,
        );

        // Return full master order with relations
        return this.masterOrderRepo.findById(result.masterOrder.id);
      } catch (error) {
        // Retry on unique constraint violation (race condition on code generation)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < MAX_RETRIES - 1
        ) {
          this.logger.warn(
            `Code generation collision, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Failed to generate unique order code after retries');
  }

  /**
   * Lists master orders with pagination, filters, and data scope.
   */
  async findAll(query: MasterOrderQueryDto, dataScope?: DataScopeFilter) {
    const where: Prisma.MasterOrderWhereInput = {};

    if (query.status) {
      where.overallStatus = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.saleId) {
      where.saleId = query.saleId;
    }

    if (query.branch) {
      where.branch = query.branch;
    }

    // Search by code or customer name
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

    const { data, total } = await this.masterOrderRepo.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.MasterOrderOrderByWithRelationInput,
      dataScope,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single master order by ID with full relations.
   * Optionally checks data scope for authorization.
   */
  async findById(id: string, dataScope?: DataScopeFilter): Promise<MasterOrderWithRelations> {
    const masterOrder = await this.masterOrderRepo.findById(id);

    if (!masterOrder) {
      throw new NotFoundException(`Master order with ID ${id} not found`);
    }

    // Check data scope authorization
    if (dataScope && !dataScope.isGlobal) {
      if (dataScope.saleId && masterOrder.saleId !== dataScope.saleId) {
        throw new ForbiddenException('You do not have permission to access this order');
      }
      if (dataScope.branch && masterOrder.branch !== dataScope.branch) {
        throw new ForbiddenException('You do not have permission to access this order');
      }
    }

    return masterOrder;
  }

  /**
   * Adds a new sub order to an existing master order.
   * Wrapped in a transaction for atomicity.
   */
  async addSubOrder(masterOrderId: string, dto: CreateSubOrderDto, currentUser: ICurrentUser) {
    const masterOrder = await this.masterOrderRepo.findById(masterOrderId);

    if (!masterOrder) {
      throw new NotFoundException(`Master order with ID ${masterOrderId} not found`);
    }

    if (masterOrder.overallStatus !== MasterOrderStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot add sub orders to a ${masterOrder.overallStatus} master order`,
      );
    }

    // Get customer for deposit calculation
    const customer = await this.prisma.customer.findUnique({
      where: { id: masterOrder.customerId },
      select: { tier: true, depositRate: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Use transaction to atomically count + create
    const subOrder = await this.prisma.$transaction(async (tx) => {
      // Count existing sub orders within the transaction
      const existingCount = await tx.order.count({
        where: { masterOrderId },
      });
      const suffix = this.masterOrderRepo.getSubOrderSuffix(existingCount);
      const subCode = this.masterOrderRepo.generateSubOrderCode(masterOrder.code, existingCount);

      // Calculate total amount using Decimal
      const totalAmount = dto.items.reduce(
        (sum, item) => sum.add(new Decimal(item.quantity).mul(new Decimal(item.unitPrice))),
        new Decimal(0),
      );

      // Calculate deposit
      const depositReq = this.depositGate.checkDepositRequirement(
        totalAmount.toNumber(),
        customer.tier,
        dto.serviceType,
        customer.depositRate,
      );

      // Create sub order
      const created = await tx.order.create({
        data: {
          code: subCode,
          customerId: masterOrder.customerId,
          saleId: currentUser.id,
          serviceType: dto.serviceType,
          status: OrderStatus.CONSULTING,
          branch: masterOrder.branch,
          shippingRoute: dto.shippingRoute,
          totalAmount,
          depositRequired: new Decimal(depositReq.depositAmount),
          masterOrderId,
          subOrderSuffix: suffix,
          clearanceType: dto.clearanceType,
          note: dto.note,
          items: {
            create: dto.items.map((item) => ({
              productName: item.productName,
              productUrl: item.productUrl,
              quantity: item.quantity,
              unitPrice: new Decimal(item.unitPrice),
              currency: item.currency ?? 'CNY',
              totalPrice: new Decimal(item.quantity).mul(new Decimal(item.unitPrice)),
              note: item.note,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Create initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: OrderStatus.CONSULTING,
          changedBy: currentUser.id,
          note: 'Sub order added to master order',
        },
      });

      return created;
    });

    this.logger.log(
      `Sub order ${subOrder.code} added to master order ${masterOrder.code} by ${currentUser.id}`,
    );

    return this.masterOrderRepo.findById(masterOrderId);
  }

  /**
   * Recalculates the overall status of a master order based on sub orders.
   * - If all sub orders COMPLETED → COMPLETED
   * - If all sub orders CANCELLED → CANCELLED
   * - Otherwise → ACTIVE
   */
  async recalculateOverallStatus(masterOrderId: string) {
    const subOrders = await this.prisma.order.findMany({
      where: { masterOrderId },
      select: { status: true },
    });

    if (subOrders.length === 0) return;

    const allCompleted = subOrders.every((o) => o.status === OrderStatus.COMPLETED);
    const allCancelled = subOrders.every((o) => o.status === OrderStatus.CANCELLED);

    let newStatus: MasterOrderStatus;
    if (allCompleted) {
      newStatus = MasterOrderStatus.COMPLETED;
    } else if (allCancelled) {
      newStatus = MasterOrderStatus.CANCELLED;
    } else {
      newStatus = MasterOrderStatus.ACTIVE;
    }

    await this.masterOrderRepo.update(masterOrderId, {
      overallStatus: newStatus,
    });

    this.logger.log(`Master order ${masterOrderId} overall status recalculated to ${newStatus}`);
  }

  /**
   * Listen to order status changes and recalculate master order status.
   */
  @OnEvent('order.status.changed')
  async handleSubOrderStatusChanged(payload: {
    orderId: string;
    fromStatus: string;
    toStatus: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: { masterOrderId: true },
    });

    if (order?.masterOrderId) {
      await this.recalculateOverallStatus(order.masterOrderId);
    }
  }
}
