import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { DataScopeService } from '@core/rbac/data-scope.service';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { CursorPaginatedResult } from '@common/dto/pagination.dto';

/** Cache TTL: 2 minutes in milliseconds. */
const ORDER_DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;

/** Cache TTL: 30 seconds for tier-1 (essential) data — loaded immediately on page open. */
const ORDER_ESSENTIAL_CACHE_TTL_MS = 30 * 1000;

/** Cache TTL: 5 minutes in milliseconds. */
const SALES_AGG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * CQRS Read Model - Optimized read queries for Order domain.
 * Uses select projections and caching to avoid loading full aggregates.
 */
@Injectable()
export class OrderReadService {
  private readonly logger = new Logger(OrderReadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  /**
   * Lightweight order list for table views.
   * Only selects fields needed for display.
   * When a user is provided, data scope is applied so SALE sees own orders,
   * SALES_LEADER sees team orders, CEO/COO sees all.
   */
  async getOrderList(params: {
    page: number;
    limit: number;
    status?: string;
    customerId?: string;
    saleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    user?: ICurrentUser;
  }) {
    const { page, limit, status, customerId, saleId, dateFrom, dateTo, user } = params;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (saleId) where.saleId = saleId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    // Apply data scope filter based on user role
    if (user) {
      const scopeFilter = await this.dataScopeService.getDataScopeFilter(
        { userId: user.id, role: user.role, branch: user.branch },
        'order',
      );
      Object.assign(where, scopeFilter);
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          code: true,
          status: true,
          serviceType: true,
          branch: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          customer: { select: { id: true, fullName: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Cursor-based order list for infinite-scroll or large-dataset views.
   * More efficient than offset pagination for deep pages because it avoids
   * the "skip N rows" overhead by seeking directly to the cursor position.
   */
  async getOrderListCursor(params: {
    cursor?: string;
    limit: number;
    status?: string;
    customerId?: string;
    saleId?: string;
  }): Promise<CursorPaginatedResult<any>> {
    const { cursor, limit, status, customerId, saleId } = params;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (saleId) where.saleId = saleId;

    const items = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        code: true,
        status: true,
        serviceType: true,
        branch: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        customer: { select: { id: true, fullName: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check hasMore
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

    return { items: resultItems, nextCursor, hasMore };
  }

  /**
   * Order detail for view page.
   * Includes all related data in a single optimized query.
   * Cached for 2 minutes to reduce repeated detail lookups.
   */
  async getOrderDetail(orderId: string) {
    return this.cacheService.getOrSet(
      `order:detail:${orderId}`,
      () =>
        this.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                code: true,
                phone: true,
                email: true,
              },
            },
            items: true,
            statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
            packages: {
              select: {
                id: true,
                code: true,
                warehouseCNStatus: true,
                warehouseVNStatus: true,
                actualWeight: true,
              },
            },
            deliveries: {
              select: {
                id: true,
                code: true,
                status: true,
                deliveredAt: true,
              },
            },
            receivables: {
              select: {
                id: true,
                code: true,
                amount: true,
                paidAmount: true,
                status: true,
              },
            },
            complaints: {
              select: {
                id: true,
                code: true,
                status: true,
                severity: true,
              },
            },
          },
        }),
      ORDER_DETAIL_CACHE_TTL_MS,
    );
  }

  /**
   * Order 360 View — comprehensive order overview with all related data.
   *
   * Returns structured blocks:
   * - sale: order info, customer, sale user
   * - goods: packages with CN/VN weight, QC inspections, supplier orders, tracking
   * - finance: total, paid, debt, exchange rates, commissions, cost allocations
   * - operations: container, deliveries, complaints
   * - auditLog: recent audit log entries for this order
   */
  async getOrder360View(orderId: string) {
    const cacheKey = `order:360:${orderId}`;
    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchOrder360View(orderId),
      ORDER_DETAIL_CACHE_TTL_MS,
    );
  }

  /** Internal: fetch full 360 view data without caching. */
  private async fetchOrder360View(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            tier: true,
            phone: true,
            email: true,
          },
        },
        contract: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            quotationId: true,
            quotation: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
        items: true,
        packages: {
          include: {
            qcInspections: true,
          },
        },
        supplierOrders: {
          select: {
            id: true,
            code: true,
            status: true,
            supplierName: true,
            supplierPlatform: true,
            totalCNY: true,
            totalVND: true,
            quantityOrdered: true,
            quantityReceived: true,
            trackingNumberCN: true,
            orderedAt: true,
            receivedAt: true,
          },
        },
        container: {
          select: {
            id: true,
            code: true,
            status: true,
            shippingRoute: true,
            carrier: true,
            estimatedDepartureAt: true,
            actualDepartureAt: true,
            estimatedArrivalAt: true,
            actualArrivalAt: true,
          },
        },
        deliveries: {
          select: {
            id: true,
            code: true,
            status: true,
            deliveredAt: true,
          },
        },
        complaints: {
          select: {
            id: true,
            code: true,
            type: true,
            severity: true,
            status: true,
            resolutionType: true,
            compensationAmount: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
        commissions: {
          select: {
            id: true,
            saleId: true,
            commissionRate: true,
            commissionAmount: true,
            status: true,
            clawbackAmount: true,
            clawbackReason: true,
            createdAt: true,
          },
        },
        costAllocations: {
          select: {
            id: true,
            containerId: true,
            method: true,
            proportion: true,
            allocatedAmount: true,
          },
        },
        allocations: {
          select: {
            id: true,
            code: true,
            totalAmount: true,
            allocatedAmount: true,
            purposeType: true,
            allocatedAt: true,
            isReversed: true,
          },
        },
        receivables: {
          select: {
            id: true,
            code: true,
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Parallelize the 3 sequential queries into a single Promise.all
    const supplierOrderIds = order.supplierOrders.map((so) => so.id);
    const [procurementPayments, auditLog, saleUser] = await Promise.all([
      // Fetch procurement payment vouchers linked to this order or its supplier orders
      this.prisma.paymentVoucher.findMany({
        where: {
          OR: [
            ...(supplierOrderIds.length > 0
              ? [{ supplierOrderId: { in: supplierOrderIds } }]
              : []),
            { orderId: orderId, supplierOrderId: { not: null } },
          ],
        },
        select: {
          id: true,
          code: true,
          type: true,
          amount: true,
          currency: true,
          status: true,
          beneficiary: true,
          reason: true,
          costType: true,
          paymentMethod: true,
          supplierOrderId: true,
          approvedBy: true,
          approvedAt: true,
          createdBy: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Fetch audit log entries for this order
      this.prisma.auditLog.findMany({
        where: { entity: 'Order', entityId: orderId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          action: true,
          oldData: true,
          newData: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
      // Fetch sale user info
      this.prisma.user.findUnique({
        where: { id: order.saleId },
        select: { id: true, fullName: true, email: true, role: true },
      }),
    ]);

    // Calculate finance summary
    const totalAmount = Number(order.totalAmount);
    const depositPaid = Number(order.depositPaid);
    const totalPaid = order.receivables.reduce((sum, ar) => sum + Number(ar.paidAmount), 0);
    const totalDebt = order.receivables.reduce(
      (sum, ar) => sum + (Number(ar.amount) - Number(ar.paidAmount)),
      0,
    );
    const totalAllocatedCost = order.costAllocations.reduce(
      (sum, ca) => sum + Number(ca.allocatedAmount),
      0,
    );
    const totalCommission = order.commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0,
    );

    // Structure into blocks
    return {
      sale: {
        id: order.id,
        code: order.code,
        status: order.status,
        serviceType: order.serviceType,
        branch: order.branch,
        shippingRoute: order.shippingRoute,
        clearanceType: order.clearanceType,
        fulfillmentStatus: order.fulfillmentStatus,
        note: order.note,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        customer: order.customer,
        saleUser,
        items: order.items,
      },
      goods: {
        packages: order.packages.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          warehouseCNStatus: pkg.warehouseCNStatus,
          warehouseVNStatus: pkg.warehouseVNStatus,
          actualWeight: pkg.actualWeight,
          chargeableWeight: pkg.chargeableWeight,
          qcInspections: pkg.qcInspections,
        })),
        supplierOrders: order.supplierOrders,
        totalActualWeight: order.totalActualWeight,
        totalChargeableWeight: order.totalChargeableWeight,
      },
      finance: {
        totalAmount,
        currency: order.currency,
        depositRequired: Number(order.depositRequired),
        depositPaid,
        isDepositPaid: order.isDepositPaid,
        discountPercent: Number(order.discountPercent),
        discountAmount: Number(order.discountAmount),
        totalPaid,
        totalDebt,
        baseExchangeRate: order.baseExchangeRate ? Number(order.baseExchangeRate) : null,
        exchangeRateMode: order.exchangeRateMode,
        commissions: order.commissions,
        totalCommission,
        costAllocations: order.costAllocations,
        totalAllocatedCost,
        paymentAllocations: order.allocations,
        receivables: order.receivables,
        procurementPayments,
        totalProcurementPaid: procurementPayments
          .filter((pv) => pv.status === 'APPROVED')
          .reduce((sum, pv) => sum + Number(pv.amount), 0),
        totalProcurementAmount: order.supplierOrders.reduce(
          (sum, so) => sum + (Number(so.totalCNY) || Number(so.totalVND) || 0),
          0,
        ),
      },
      operations: {
        container: order.container,
        deliveries: order.deliveries,
        complaints: order.complaints,
      },
      auditLog,
    };
  }

  // ─── Tiered 360 View ────────────────────────────────────────────────────────

  /**
   * Tier-1 essential data for the Order detail page.
   *
   * Loads only the fields needed for immediate page render:
   * - Order header fields
   * - Items
   * - Customer summary
   * - Status history (last 10 entries)
   * - Contract + quotation reference
   * - Sale user
   *
   * Cached for 30 seconds (short TTL because this is the "above-the-fold"
   * data and must feel fresh when navigating between orders).
   *
   * Returns the same `sale` block shape as `getOrder360View` so the
   * frontend can render the header without waiting for tier-2.
   */
  async findByIdEssential(orderId: string) {
    const cacheKey = `order:essential:${orderId}`;
    this.logger.log(`findByIdEssential orderId=${orderId}`);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchOrderEssential(orderId),
      ORDER_ESSENTIAL_CACHE_TTL_MS,
    );
  }

  /**
   * Tier-2 extended data for the Order detail page.
   *
   * Loads heavier relations that are deferred until the user scrolls or
   * explicitly requests them:
   * - Packages (with QC inspections)
   * - Supplier orders
   * - Container
   * - Deliveries
   * - Complaints
   * - Commissions
   * - Cost allocations
   * - Payment allocations (AR receivables)
   * - Procurement payment vouchers
   * - Audit log (last 50 entries)
   *
   * Cached for 2 minutes.  Cache is invalidated by `invalidateOrder360Cache`
   * when the order or any of its sub-entities mutate.
   */
  async findByIdExtended(orderId: string) {
    const cacheKey = `order:extended:${orderId}`;
    this.logger.log(`findByIdExtended orderId=${orderId}`);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchOrderExtended(orderId),
      ORDER_DETAIL_CACHE_TTL_MS,
    );
  }

  /** Internal: fetch tier-1 essential fields without caching. */
  private async fetchOrderEssential(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            tier: true,
            phone: true,
            email: true,
          },
        },
        contract: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            quotationId: true,
            quotation: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          // Tier-1 only loads the 10 most recent status transitions —
          // this covers 99% of practical read needs without the overhead
          // of fetching the full history.
          take: 10,
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Fetch sale user in parallel (single extra query, avoids N+1)
    const saleUser = await this.prisma.user.findUnique({
      where: { id: order.saleId },
      select: { id: true, fullName: true, email: true, role: true },
    });

    return {
      sale: {
        id: order.id,
        code: order.code,
        status: order.status,
        serviceType: order.serviceType,
        branch: order.branch,
        shippingRoute: order.shippingRoute,
        clearanceType: order.clearanceType,
        fulfillmentStatus: order.fulfillmentStatus,
        note: order.note,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        depositRequired: Number(order.depositRequired),
        depositPaid: Number(order.depositPaid),
        isDepositPaid: order.isDepositPaid,
        customer: order.customer,
        saleUser,
        contract: order.contract,
        items: order.items,
      },
      // Provide the last 10 status history entries for the timeline widget
      statusHistory: order.statusHistory,
    };
  }

  /** Internal: fetch tier-2 extended fields without caching. */
  private async fetchOrderExtended(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      // Select only the scalar fields we need for finance summaries —
      // all heavy relations are fetched below via individual includes.
      select: {
        id: true,
        saleId: true,
        totalAmount: true,
        currency: true,
        discountPercent: true,
        discountAmount: true,
        depositPaid: true,
        baseExchangeRate: true,
        exchangeRateMode: true,
        totalActualWeight: true,
        totalChargeableWeight: true,
        packages: {
          include: {
            qcInspections: true,
          },
        },
        supplierOrders: {
          select: {
            id: true,
            code: true,
            status: true,
            supplierName: true,
            supplierPlatform: true,
            totalCNY: true,
            totalVND: true,
            quantityOrdered: true,
            quantityReceived: true,
            trackingNumberCN: true,
            orderedAt: true,
            receivedAt: true,
          },
        },
        container: {
          select: {
            id: true,
            code: true,
            status: true,
            shippingRoute: true,
            carrier: true,
            estimatedDepartureAt: true,
            actualDepartureAt: true,
            estimatedArrivalAt: true,
            actualArrivalAt: true,
          },
        },
        deliveries: {
          select: {
            id: true,
            code: true,
            status: true,
            deliveredAt: true,
          },
        },
        complaints: {
          select: {
            id: true,
            code: true,
            type: true,
            severity: true,
            status: true,
            resolutionType: true,
            compensationAmount: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
        commissions: {
          select: {
            id: true,
            saleId: true,
            commissionRate: true,
            commissionAmount: true,
            status: true,
            clawbackAmount: true,
            clawbackReason: true,
            createdAt: true,
          },
        },
        costAllocations: {
          select: {
            id: true,
            containerId: true,
            method: true,
            proportion: true,
            allocatedAmount: true,
          },
        },
        allocations: {
          select: {
            id: true,
            code: true,
            totalAmount: true,
            allocatedAmount: true,
            purposeType: true,
            allocatedAt: true,
            isReversed: true,
          },
        },
        receivables: {
          select: {
            id: true,
            code: true,
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Fetch procurement payment vouchers and audit log in parallel
    const supplierOrderIds = order.supplierOrders.map((so) => so.id);
    const [procurementPayments, auditLog] = await Promise.all([
      this.prisma.paymentVoucher.findMany({
        where: {
          OR: [
            ...(supplierOrderIds.length > 0
              ? [{ supplierOrderId: { in: supplierOrderIds } }]
              : []),
            { orderId: orderId, supplierOrderId: { not: null } },
          ],
        },
        select: {
          id: true,
          code: true,
          type: true,
          amount: true,
          currency: true,
          status: true,
          beneficiary: true,
          reason: true,
          costType: true,
          paymentMethod: true,
          supplierOrderId: true,
          approvedBy: true,
          approvedAt: true,
          createdBy: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { entity: 'Order', entityId: orderId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          action: true,
          oldData: true,
          newData: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    // Finance summary calculations (same logic as fetchOrder360View)
    const totalPaid = order.receivables.reduce((sum, ar) => sum + Number(ar.paidAmount), 0);
    const totalDebt = order.receivables.reduce(
      (sum, ar) => sum + (Number(ar.amount) - Number(ar.paidAmount)),
      0,
    );
    const totalAllocatedCost = order.costAllocations.reduce(
      (sum, ca) => sum + Number(ca.allocatedAmount),
      0,
    );
    const totalCommission = order.commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0,
    );

    return {
      goods: {
        packages: order.packages.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          warehouseCNStatus: pkg.warehouseCNStatus,
          warehouseVNStatus: pkg.warehouseVNStatus,
          actualWeight: pkg.actualWeight,
          chargeableWeight: pkg.chargeableWeight,
          qcInspections: pkg.qcInspections,
        })),
        supplierOrders: order.supplierOrders,
        totalActualWeight: order.totalActualWeight,
        totalChargeableWeight: order.totalChargeableWeight,
      },
      finance: {
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        depositPaid: Number(order.depositPaid),
        discountPercent: Number(order.discountPercent),
        discountAmount: Number(order.discountAmount),
        totalPaid,
        totalDebt,
        baseExchangeRate: order.baseExchangeRate ? Number(order.baseExchangeRate) : null,
        exchangeRateMode: order.exchangeRateMode,
        commissions: order.commissions,
        totalCommission,
        costAllocations: order.costAllocations,
        totalAllocatedCost,
        paymentAllocations: order.allocations,
        receivables: order.receivables,
        procurementPayments,
        totalProcurementPaid: procurementPayments
          .filter((pv) => pv.status === 'APPROVED')
          .reduce((sum, pv) => sum + Number(pv.amount), 0),
        totalProcurementAmount: order.supplierOrders.reduce(
          (sum, so) => sum + (Number(so.totalCNY) || Number(so.totalVND) || 0),
          0,
        ),
      },
      operations: {
        container: order.container,
        deliveries: order.deliveries,
        complaints: order.complaints,
      },
      auditLog,
    };
  }

  /**
   * Sales dashboard aggregation.
   * Heavy query - cached for 5 minutes.
   */
  async getSalesAggregation(saleId: string, dateFrom: Date, dateTo: Date) {
    const cacheKey = `order:sales-agg:${saleId}:${dateFrom.toISOString().slice(0, 10)}:${dateTo.toISOString().slice(0, 10)}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const [orders, revenue, byStatus] = await Promise.all([
          this.prisma.order.count({
            where: { saleId, createdAt: { gte: dateFrom, lte: dateTo } },
          }),
          this.prisma.order.aggregate({
            where: { saleId, createdAt: { gte: dateFrom, lte: dateTo } },
            _sum: { totalAmount: true },
          }),
          this.prisma.order.groupBy({
            by: ['status'],
            where: { saleId, createdAt: { gte: dateFrom, lte: dateTo } },
            _count: true,
          }),
        ]);

        return {
          totalOrders: orders,
          totalRevenue: revenue._sum.totalAmount ?? 0,
          byStatus: byStatus.map((s) => ({
            status: s.status,
            count: s._count,
          })),
        };
      },
      SALES_AGG_CACHE_TTL_MS,
    );
  }
}
