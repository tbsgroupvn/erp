import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { DomainException, ErrorCode } from '@common/exceptions';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
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

/** TTL for order list cache: 2 minutes in milliseconds. */
const ORDER_LIST_CACHE_TTL_MS = 2 * 60 * 1000;

/** TTL for order detail cache: 2 minutes in milliseconds. */
const ORDER_DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Generates a stable, short hash string from a query-params object.
 * Used to build cache keys for paginated/filtered list queries.
 * Sorting the keys guarantees the same params in different order
 * produce the same hash.
 */
function hashQueryParams(params: Record<string, unknown>): string {
  const stable = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        acc[k] = params[k];
      }
      return acc;
    }, {});

  const json = JSON.stringify(stable);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const chr = json.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  // Return as unsigned hex to avoid negative sign in the key
  return (hash >>> 0).toString(16);
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly prisma: PrismaService,
    private readonly depositGate: DepositGateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly cacheService: CacheService,
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
      throw new DomainException(ErrorCode.ORDER_CREATION_FAILED, 'Failed to create order after 3 attempts', HttpStatus.INTERNAL_SERVER_ERROR);
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
   * Results are cached per unique combination of query params + data scope
   * for 2 minutes to reduce repeated list queries.
   */
  async findAll(query: OrderQueryDto, dataScope?: DataScopeFilter) {
    // Build a stable cache key from all query params and scope info
    const cacheKey = `orders:list:${hashQueryParams({
      ...query,
      // Include data-scope fields so user A does not see user B's scoped list
      scopeGlobal: dataScope?.isGlobal,
      scopeSaleId: dataScope?.saleId,
      scopeBranch: dataScope?.branch,
    })}`;

    try {
      const cached = await this.cacheService.get<{
        data: unknown[];
        total: number;
        page: number;
        limit: number;
      }>(cacheKey);

      if (cached) {
        return cached;
      }
    } catch {
      // Cache read failure must never break the request
    }

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

    // Search by order code or customer name.
    //
    // Trigram GIN indexes (pg_trgm) are only effective for patterns of 3+
    // characters — shorter strings force a sequential scan.
    // - search >= 3 chars: use ILIKE (contains) so the GIN index is used
    // - search 1–2 chars:  fall back to prefix match (startsWith) which uses
    //   the B-tree index on order.code and avoids a full table scan
    if (query.search && query.search.length >= 3) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
      ];
    } else if (query.search) {
      // Short search: prefix match on order code only (B-tree index friendly)
      where.OR = [{ code: { startsWith: query.search, mode: 'insensitive' } }];
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

    const result = { data, total, page: query.page, limit: query.limit };

    try {
      await this.cacheService.set(cacheKey, result, ORDER_LIST_CACHE_TTL_MS);
    } catch {
      // Cache write failure must never break the request
    }

    return result;
  }

  /**
   * Gets a single order by ID with full relations.
   * Optionally checks data scope for authorization.
   * Result is cached for 2 minutes; cache is invalidated on any mutation.
   *
   * NOTE: Data-scope authorization is always enforced on the live result —
   * the cache key is NOT scoped per user so that cached data is shared
   * across requests and the scope check still runs every call.
   */
  async findById(id: string, dataScope?: DataScopeFilter): Promise<OrderWithRelations> {
    const cacheKey = `order:detail:${id}`;

    let order: OrderWithRelations | null = null;

    try {
      order = await this.cacheService.get<OrderWithRelations>(cacheKey) ?? null;
    } catch {
      // Cache read failure must never break the request
    }

    if (!order) {
      order = await this.orderRepo.findById(id);

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      try {
        await this.cacheService.set(cacheKey, order, ORDER_DETAIL_CACHE_TTL_MS);
      } catch {
        // Cache write failure must never break the request
      }
    }

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Check data scope authorization (always enforced, even on cached data)
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

    // Eagerly invalidate all caches that could hold stale data for this order:
    //   - order:detail:<id>     — full detail via OrderRepository.findById
    //   - order:360:<id>        — comprehensive 360 view
    //   - order:essential:<id>  — tier-1 immediate data (new tiered view)
    //   - order:extended:<id>   — tier-2 deferred data (new tiered view)
    //   - orders:list:*         — all paginated list pages (hashed keys under
    //                             this prefix); uses delByPrefix which is an
    //                             alias for the Redis KEYS + DEL pattern scan
    try {
      await Promise.all([
        this.cacheService.del(`order:detail:${id}`),
        this.cacheService.del(`order:360:${id}`),
        this.cacheService.del(`order:essential:${id}`),
        this.cacheService.del(`order:extended:${id}`),
        this.cacheService.delByPrefix('orders:list:'),
      ]);
    } catch {
      // Cache invalidation failure must never break the request
    }

    this.eventEmitter.emit('order.updated', {
      orderId: id,
      updatedBy: currentUser.id,
      changes: dto,
    });

    return updated;
  }

  /**
   * P0-2: Reopen a COMPLETED order back to SETTLEMENT status.
   *
   * Only allowed for BGĐ (CEO, COO, SALES_DIRECTOR).
   * Use case: order was completed prematurely, needs financial reconciliation.
   */
  async reopenOrder(orderId: string, currentUser: ICurrentUser, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException(
        `Chỉ có thể mở lại đơn hàng ở trạng thái COMPLETED. Hiện tại: ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SETTLEMENT,
        statusHistory: {
          create: {
            fromStatus: OrderStatus.COMPLETED,
            toStatus: OrderStatus.SETTLEMENT,
            changedBy: currentUser.id,
            note: `Mở lại đơn: ${reason}`,
          },
        },
      },
    });

    // Invalidate caches
    try {
      await Promise.all([
        this.cacheService.del(`order:detail:${orderId}`),
        this.cacheService.del(`order:360:${orderId}`),
        this.cacheService.del(`order:essential:${orderId}`),
        this.cacheService.del(`order:extended:${orderId}`),
        this.cacheService.delByPrefix('orders:list:'),
      ]);
    } catch {
      // Cache invalidation failure must never break the request
    }

    this.eventEmitter.emit('order.reopened', {
      orderId,
      orderCode: order.code,
      reopenedBy: currentUser.id,
      reason,
    });

    this.eventEmitter.emit('order.status.changed', {
      orderId,
      orderCode: order.code,
      fromStatus: OrderStatus.COMPLETED,
      toStatus: OrderStatus.SETTLEMENT,
      changedBy: currentUser.id,
    });

    this.logger.log(`Order ${order.code} reopened from COMPLETED to SETTLEMENT by ${currentUser.id}: ${reason}`);

    return updated;
  }
}
