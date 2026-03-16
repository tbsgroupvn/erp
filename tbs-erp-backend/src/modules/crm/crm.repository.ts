import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { Customer, CustomerTier, Prisma } from '@prisma/client';
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
  ): Promise<{ data: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = { ...scopeFilter };

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
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
        include: {
          contacts: true,
          wallet: true,
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
}
