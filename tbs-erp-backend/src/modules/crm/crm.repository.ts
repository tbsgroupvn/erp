import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Customer, CustomerTier, Prisma } from '@prisma/client';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CrmRepository {
  private readonly logger = new Logger(CrmRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique customer code: TBS-KH-000001
   */
  async generateCode(): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (lastCustomer?.code) {
      const match = lastCustomer.code.match(/TBS-KH-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-KH-${String(nextNumber).padStart(6, '0')}`;
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
  async update(
    id: string,
    data: Prisma.CustomerUpdateInput,
  ): Promise<Customer> {
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
   * Find customers with pagination, search, and filters.
   */
  async findMany(
    query: CustomerQueryDto,
  ): Promise<{ data: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {};

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
  async incrementOrderStats(
    customerId: string,
    revenue: number,
  ): Promise<Customer> {
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
