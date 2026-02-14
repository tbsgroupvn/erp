import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AccountPayable, Prisma } from '@prisma/client';
import { ApQueryDto } from './dto/ap-query.dto';

@Injectable()
export class AccountsPayableRepository {
  private readonly logger = new Logger(AccountsPayableRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique AP code: TBS-AP-000001
   */
  async generateCode(): Promise<string> {
    const last = await this.prisma.accountPayable.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(/TBS-AP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-AP-${String(nextNumber).padStart(6, '0')}`;
  }

  async create(
    data: Prisma.AccountPayableCreateInput,
  ): Promise<AccountPayable> {
    return this.prisma.accountPayable.create({ data });
  }

  async findById(id: string): Promise<AccountPayable | null> {
    return this.prisma.accountPayable.findUnique({
      where: { id },
    });
  }

  async findMany(
    query: ApQueryDto,
  ): Promise<{ data: AccountPayable[]; total: number }> {
    const where: Prisma.AccountPayableWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { vendorName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.accountPayable.findMany({
        where,
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.accountPayable.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get all payables for a specific vendor.
   */
  async findByVendor(vendorId: string): Promise<AccountPayable[]> {
    return this.prisma.accountPayable.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.AccountPayableUpdateInput,
  ): Promise<AccountPayable> {
    return this.prisma.accountPayable.update({
      where: { id },
      data,
    });
  }

  /**
   * Get total outstanding payables summary.
   */
  async getSummary(): Promise<{
    totalOpen: number;
    totalOverdue: number;
    count: number;
  }> {
    const payables = await this.prisma.accountPayable.findMany({
      where: { status: { in: ['OPEN', 'PARTIAL'] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    });

    const now = new Date();
    let totalOpen = 0;
    let totalOverdue = 0;

    for (const ap of payables) {
      const outstanding = ap.amount.toNumber() - ap.paidAmount.toNumber();
      totalOpen += outstanding;
      if (ap.dueDate < now) {
        totalOverdue += outstanding;
      }
    }

    return { totalOpen, totalOverdue, count: payables.length };
  }
}
