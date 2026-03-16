import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, ServiceType, Prisma, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { buildDateFilter } from '@common/utils/date.util';
import { DataScopeFilter } from '@common/guards/data-scope.guard';
import { OrderRepository, OrderWithRelations } from './order.repository';
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
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
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
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = dto.items.map((item) => ({
      productName: item.productName,
      productUrl: item.productUrl,
      quantity: item.quantity,
      unitPrice: new Decimal(item.unitPrice),
      currency: item.currency ?? 'CNY',
      totalPrice: new Decimal(item.quantity * item.unitPrice),
      note: item.note,
    }));

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

    // Wrap order creation and initial status history in a single transaction
    // so that a failure during status history insertion rolls back the order row.
    // Event emission is intentionally placed AFTER the transaction commits.
    const orderData: Prisma.OrderCreateInput = {
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
    };

    let order: Awaited<ReturnType<typeof this.orderRepo.create>> =
      undefined as unknown as Awaited<ReturnType<typeof this.orderRepo.create>>;

    // Retry loop mirrors orderRepo.create() to handle P2002 code collisions.
    let created = false;
    let attempt = 0;
    while (!created && attempt < 3) {
      const dataForAttempt: Prisma.OrderCreateInput =
        attempt > 0
          ? { ...orderData, code: await this.orderRepo.generateOrderCode() }
          : orderData;

      try {
        order = await this.prisma.$transaction(async (tx) => {
          // 1. Create order + items atomically
          const newOrder = await tx.order.create({
            data: {
              ...dataForAttempt,
              items: { create: items },
            },
            include: {
              items: { where: { deletedAt: null } },
              customer: {
                select: {
                  id: true,
                  code: true,
                  fullName: true,
                  companyName: true,
                  tier: true,
                  phone: true,
                },
              },
            },
          });

          // 2. Create initial status history in the same transaction
          await tx.orderStatusHistory.create({
            data: {
              orderId: newOrder.id,
              fromStatus: null,
              toStatus: OrderStatus.CONSULTING,
              changedBy: currentUser.id,
              note: 'Order created',
            },
          });

          return newOrder;
        });

        created = true;
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Order code conflict on attempt ${attempt + 1}, retrying...`);
          attempt++;
          continue;
        }
        throw error;
      }
    }

    if (!created) {
      throw new Error('Failed to create order after 3 attempts');
    }

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
    const dateFilter = buildDateFilter(query.startDate, query.endDate);
    if (dateFilter) {
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
    const editableStatuses: OrderStatus[] = [OrderStatus.CONSULTING, OrderStatus.QUOTATION];

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
        currency: item.currency ?? ('CNY' as any),
        totalPrice: new Decimal(item.quantity * item.unitPrice),
        note: item.note,
      }));

      await this.orderRepo.replaceItems(id, newItems);

      // Recalculate total amount
      const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      updateData.totalAmount = new Decimal(totalAmount);

      // Recalculate deposit if needed
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { tier: true, depositRate: true },
      });

      if (customer) {
        const serviceType = (dto.serviceType as ServiceType) ?? order.serviceType;
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
}
