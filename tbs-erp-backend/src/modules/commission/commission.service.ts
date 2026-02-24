import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { CommissionDateRangeDto } from './dto/commission-query.dto';
import { CommissionCalculatorService } from './services/commission-calculator.service';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CommissionCalculatorService,
  ) { }

  /**
   * Creates a commission rule.
   */
  async createRule(dto: CreateCommissionRuleDto) {
    if (dto.minProfit >= dto.maxProfit) {
      throw new BadRequestException('minProfit must be less than maxProfit.');
    }

    const rule = await this.prisma.commissionRule.create({
      data: {
        serviceType: dto.serviceType,
        minProfit: dto.minProfit,
        maxProfit: dto.maxProfit,
        rate: dto.rate,
        description: dto.description,
      },
    });

    this.logger.log(
      `Commission rule created: ${dto.serviceType} ${dto.minProfit}-${dto.maxProfit} at ${dto.rate * 100}%`,
    );

    return rule;
  }

  /**
   * Lists all active commission rules.
   */
  async getRules() {
    return this.prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: [{ serviceType: 'asc' }, { minProfit: 'asc' }],
      take: 500,
    });
  }

  /**
   * Calculates commission for a completed order.
   *
   * 1. Get order revenue (totalAmount)
   * 2. Subtract costs from CostAllocation
   * 3. Net profit = revenue - costs
   * 4. Find applicable rule by serviceType + profit range
   * 5. Commission = netProfit * rate
   * 6. Create CommissionRecord
   *
   * @deprecated Use CommissionCalculatorService directly in listeners
   */
  async calculateCommission(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        saleId: true,
        serviceType: true,
        totalAmount: true,
        status: true,
        costAllocations: {
          select: { allocatedAmount: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found.`);
    }

    // Check for existing commission record
    const existing = await this.prisma.commissionRecord.findFirst({
      where: { orderId },
    });

    if (existing) {
      this.logger.warn(`Commission already calculated for order ${order.code}`);
      return existing;
    }

    // Use CommissionCalculatorService to calculate commission
    const result = await this.calculator.calculateCommission(order);

    if (!result) {
      this.logger.log(
        `No commission rule found for ${order.serviceType}`,
      );
      return null;
    }

    // Create commission record
    const record = await this.prisma.commissionRecord.create({
      data: {
        orderId,
        saleId: order.saleId,
        orderRevenue: result.revenue,
        orderCost: result.cost,
        netProfit: result.profit,
        commissionRate: result.rate,
        commissionAmount: result.amount,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Commission for order ${order.code}: revenue=${result.revenue}, cost=${result.cost}, profit=${result.profit}, commission=${result.amount}`,
    );

    return record;
  }

  /**
   * Gets commission history for a specific sale user.
   */
  async getMyCommissions(userId: string, dateRange: CommissionDateRangeDto) {
    const where: any = { saleId: userId };

    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) {
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const records = await this.prisma.commissionRecord.findMany({
      where,
      include: {
        order: { select: { code: true, serviceType: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = records.reduce((sum, r) => sum + Number(r.commissionAmount), 0);

    return { records, total };
  }

  /**
   * Gets team commission summary for a leader.
   */
  async getTeamCommissions(leaderId: string, dateRange: CommissionDateRangeDto) {
    // Find team members (direct reports)
    const teamMembers = await this.prisma.user.findMany({
      where: { leaderId },
      select: { id: true, fullName: true },
    });

    const memberIds = [leaderId, ...teamMembers.map((m) => m.id)];

    const dateFilter: any = {};
    if (dateRange.startDate) dateFilter.gte = new Date(dateRange.startDate);
    if (dateRange.endDate) {
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const records = await this.prisma.commissionRecord.findMany({
      where: {
        saleId: { in: memberIds },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        sale: { select: { id: true, fullName: true } },
        order: { select: { code: true, serviceType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by sale
    const byMember = new Map<string, { name: string; total: number; count: number }>();
    for (const record of records) {
      const key = record.saleId;
      const current = byMember.get(key) ?? { name: record.sale.fullName, total: 0, count: 0 };
      current.total += Number(record.commissionAmount);
      current.count += 1;
      byMember.set(key, current);
    }

    return {
      members: Array.from(byMember.entries()).map(([id, data]) => ({
        userId: id,
        ...data,
      })),
      totalRecords: records.length,
      totalCommission: records.reduce((sum, r) => sum + Number(r.commissionAmount), 0),
    };
  }

  /**
   * Approves a commission record (by KT TH - Chief Accountant).
   */
  async approveCommission(id: string, userId: string) {
    const record = await this.prisma.commissionRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Commission record ${id} not found.`);
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException(
        `Commission record is in status ${record.status}, cannot approve.`,
      );
    }

    const updated = await this.prisma.commissionRecord.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Commission ${id} approved by ${userId}`);

    return updated;
  }

  /**
   * Claws back a commission due to a complaint resolution (REFUND/CREDIT).
   *
   * - PAID: Set status=ON_HOLD, save clawback fields
   * - APPROVED (not yet paid): Set status=ON_HOLD, save clawback fields
   * - PENDING: Delete the record (cancel it)
   */
  async clawbackCommission(orderId: string, complaintId: string, reason: string) {
    const record = await this.prisma.commissionRecord.findFirst({
      where: { orderId },
    });

    if (!record) {
      this.logger.warn(
        `No commission record found for order ${orderId} — skipping clawback`,
      );
      return null;
    }

    if (record.status === 'PENDING') {
      // Cancel the record entirely — commission was never approved or paid
      await this.prisma.commissionRecord.delete({
        where: { id: record.id },
      });

      this.logger.log(
        `Commission ${record.id} for order ${orderId} deleted (was PENDING). Complaint: ${complaintId}`,
      );

      return { action: 'DELETED', commissionId: record.id };
    }

    if (record.status === 'APPROVED' || record.status === 'PAID') {
      const updated = await this.prisma.commissionRecord.update({
        where: { id: record.id },
        data: {
          status: 'ON_HOLD',
          clawbackAmount: record.commissionAmount,
          clawbackReason: reason,
          clawbackComplaintId: complaintId,
          clawbackAt: new Date(),
        },
      });

      this.logger.log(
        `Commission ${record.id} for order ${orderId} set to ON_HOLD (was ${record.status}). ` +
          `Clawback amount: ${record.commissionAmount}. Complaint: ${complaintId}`,
      );

      return { action: 'ON_HOLD', commissionId: record.id, previousStatus: record.status, clawbackAmount: Number(record.commissionAmount) };
    }

    // Status is already ON_HOLD or unknown — no action needed
    this.logger.warn(
      `Commission ${record.id} for order ${orderId} is already in status ${record.status} — skipping clawback`,
    );

    return { action: 'SKIPPED', commissionId: record.id, currentStatus: record.status };
  }

  /**
   * Gets monthly commission report.
   */
  async getMonthlyReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const records = await this.prisma.commissionRecord.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        sale: { select: { id: true, fullName: true, role: true } },
        order: { select: { code: true, serviceType: true } },
      },
      orderBy: { commissionAmount: 'desc' },
    });

    const summary = {
      period: `${year}-${String(month).padStart(2, '0')}`,
      totalRecords: records.length,
      totalCommission: records.reduce((sum, r) => sum + Number(r.commissionAmount), 0),
      totalRevenue: records.reduce((sum, r) => sum + Number(r.orderRevenue), 0),
      totalProfit: records.reduce((sum, r) => sum + Number(r.netProfit), 0),
      byStatus: {
        pending: records.filter((r) => r.status === 'PENDING').length,
        approved: records.filter((r) => r.status === 'APPROVED').length,
        paid: records.filter((r) => r.status === 'PAID').length,
      },
      records,
    };

    return summary;
  }
}
