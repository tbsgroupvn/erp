import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { AccountStatus, Customer, CustomerTier, Prisma } from '@prisma/client';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CrmRepository {
  private readonly logger = new Logger(CrmRepository.name);
  private readonly customerCodePrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.customerCodePrefix =
      this.configService.get<string>('branding.customerCodePrefix') || 'ERP-KH-';
  }

  /**
   * Generate a unique customer code with configurable prefix.
   */
  async generateCode(): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (lastCustomer?.code) {
      const prefix = this.customerCodePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = lastCustomer.code.match(new RegExp(`${prefix}(\\d+)`));
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${this.customerCodePrefix}${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Create a new customer record.
   */
  async create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({
      data,
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Update an existing customer.
   */
  async update(id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data,
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Find a single customer by ID.
   */
  async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Find a single customer by ID with data-scope filter applied.
   * Returns null if the customer doesn't match the scope.
   */
  async findByIdWithScope(
    id: string,
    scopeFilter: Record<string, any>,
  ): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { id, ...scopeFilter },
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Find a single customer by code.
   */
  async findByCode(code: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { code },
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Find a single customer by phone.
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { phone },
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Find customers with pagination, search, and filters.
   * @param scopeFilter - Data-scope WHERE clause from DataScopeService
   */
  async findMany(
    query: CustomerQueryDto,
    scopeFilter: Record<string, any> = {},
  ): Promise<{ data: any[]; total: number }> {
    const where: Prisma.CustomerWhereInput = { ...scopeFilter };

    if (query.search && query.search.length >= 3) {
      // Long enough for trigram GIN index — use full contains scan across all text fields.
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    } else if (query.search) {
      // Short query (< 3 chars): trigram indexes are not engaged.
      // Fall back to B-tree prefix match on indexed low-cardinality fields only.
      where.OR = [
        { code: { startsWith: query.search, mode: 'insensitive' } },
        { phone: { startsWith: query.search } },
      ];
    }

    if (query.tier) {
      where.tier = query.tier;
    }

    if (query.branch) {
      where.branch = query.branch;
    }

    if (query.saleId) {
      where.saleId = query.saleId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          code: true,
          fullName: true,
          companyName: true,
          phone: true,
          email: true,
          tier: true,
          branch: true,
          saleId: true,
          isActive: true,
          isBlocked: true,
          totalOrders: true,
          totalRevenue: true,
          currentDebt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { contacts: true } },
        },
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Increment the customer's totalOrders and totalRevenue.
   */
  async incrementOrderStats(customerId: string, revenue: number): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        totalOrders: { increment: 1 },
        totalRevenue: { increment: new Prisma.Decimal(revenue) },
      },
    });
  }

  /**
   * Update customer tier and related deposit/credit fields.
   */
  async updateTier(
    customerId: string,
    tier: CustomerTier,
    depositRate: number,
    creditLimit: number,
  ): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        tier,
        depositRate,
        creditLimit: new Prisma.Decimal(creditLimit),
      },
    });
  }

  /**
   * Batch-fetch outstanding and overdue debt totals for a list of customers.
   *
   * Uses a single `groupBy` aggregation instead of one query per customer,
   * reducing N AR queries to 2 database round-trips (outstanding + overdue).
   *
   * @param customerIds - IDs of the customers to look up
   * @returns Map keyed by customerId with `{ outstanding, overdue }` in numeric form
   */
  async getCustomerDebts(
    customerIds: string[],
  ): Promise<Map<string, { outstanding: number; overdue: number }>> {
    if (customerIds.length === 0) {
      return new Map();
    }

    // One aggregation for all open/partial/overdue balances per customer.
    const [outstandingRows, overdueRows] = await Promise.all([
      this.prisma.accountReceivable.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: { in: [AccountStatus.OPEN, AccountStatus.PARTIAL, AccountStatus.OVERDUE] },
        },
        _sum: {
          amount: true,
          paidAmount: true,
          nettedAmount: true,
        },
      }),
      // Separate query for overdue-only bucket (status = OVERDUE).
      this.prisma.accountReceivable.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: AccountStatus.OVERDUE,
        },
        _sum: {
          amount: true,
          paidAmount: true,
          nettedAmount: true,
        },
      }),
    ]);

    // Index overdue rows by customerId for O(1) lookup.
    const overdueByCustomer = new Map<string, number>();
    for (const row of overdueRows) {
      const overdue =
        (row._sum.amount?.toNumber() ?? 0) -
        (row._sum.paidAmount?.toNumber() ?? 0) -
        (row._sum.nettedAmount?.toNumber() ?? 0);
      overdueByCustomer.set(row.customerId, Math.max(0, overdue));
    }

    const result = new Map<string, { outstanding: number; overdue: number }>();
    for (const row of outstandingRows) {
      const outstanding =
        (row._sum.amount?.toNumber() ?? 0) -
        (row._sum.paidAmount?.toNumber() ?? 0) -
        (row._sum.nettedAmount?.toNumber() ?? 0);
      result.set(row.customerId, {
        outstanding: Math.max(0, outstanding),
        overdue: overdueByCustomer.get(row.customerId) ?? 0,
      });
    }

    // Ensure every requested customer is represented in the map (zero debt).
    for (const id of customerIds) {
      if (!result.has(id)) {
        result.set(id, { outstanding: 0, overdue: 0 });
      }
    }

    return result;
  }
}
