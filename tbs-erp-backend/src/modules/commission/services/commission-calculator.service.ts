import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ServiceType } from '@prisma/client';

export interface CommissionCalculationResult {
  revenue: number;
  cost: number;
  profit: number;
  rate: number;
  amount: number;
}

export interface OrderWithCosts {
  id: string;
  code: string;
  saleId: string;
  serviceType: ServiceType;
  totalAmount: number | { toNumber: () => number };
  costAllocations: Array<{
    allocatedAmount: number | { toNumber: () => number };
  }>;
}

/**
 * Service responsible for calculating commission based on profit margins.
 * Uses tiered commission rules stored in the database.
 */
@Injectable()
export class CommissionCalculatorService {
  private readonly logger = new Logger(CommissionCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate commission for an order based on profit margin.
   *
   * @param order - Order with cost allocations
   * @returns Commission calculation result or null if no applicable rule
   */
  async calculateCommission(
    order: OrderWithCosts,
  ): Promise<CommissionCalculationResult | null> {
    // Calculate revenue from order total amount
    const revenue =
      typeof order.totalAmount === 'number'
        ? order.totalAmount
        : order.totalAmount.toNumber();

    // Calculate total costs from cost allocations
    const totalCost = order.costAllocations.reduce((sum, alloc) => {
      const amount =
        typeof alloc.allocatedAmount === 'number'
          ? alloc.allocatedAmount
          : alloc.allocatedAmount.toNumber();
      return sum + amount;
    }, 0);

    // Calculate net profit (revenue - cost)
    const netProfit = revenue - totalCost;

    this.logger.debug(
      `Order ${order.code}: revenue=${revenue}, cost=${totalCost}, profit=${netProfit}`,
    );

    // Query CommissionRule to get applicable rate
    const rule = await this.getApplicableCommissionRule(
      order.serviceType,
      netProfit,
    );

    if (!rule) {
      this.logger.log(
        `No commission rule found for ${order.serviceType} with profit ${netProfit}`,
      );
      return null;
    }

    // Calculate commission amount
    const commissionAmount = netProfit * rule.rate;

    this.logger.log(
      `Commission rule applied: ${order.serviceType} profit ${netProfit} → rate ${rule.rate * 100}% → amount ${commissionAmount}`,
    );

    return {
      revenue,
      cost: totalCost,
      profit: netProfit,
      rate: rule.rate,
      amount: commissionAmount,
    };
  }

  /**
   * Get the applicable commission rule based on service type and profit margin.
   * Uses tiered rate system based on profit ranges.
   *
   * @param serviceType - Type of service (VCT, MHH, UTXNK, LCLCN)
   * @param profit - Net profit amount
   * @returns Commission rule or null if no matching rule
   */
  private async getApplicableCommissionRule(
    serviceType: ServiceType,
    profit: number,
  ) {
    const rule = await this.prisma.commissionRule.findFirst({
      where: {
        serviceType,
        isActive: true,
        minProfit: { lte: profit },
        maxProfit: { gt: profit },
      },
      orderBy: {
        minProfit: 'desc', // Get the highest tier that matches
      },
    });

    if (rule) {
      this.logger.debug(
        `Found commission rule: ${serviceType} [${rule.minProfit}-${rule.maxProfit}] @ ${rule.rate * 100}%`,
      );
    }

    return rule;
  }

  /**
   * Get all active commission rules grouped by service type.
   * Useful for displaying tier structure to users.
   */
  async getCommissionTiers(): Promise<
    Record<ServiceType, Array<{ minProfit: number; maxProfit: number; rate: number }>>
  > {
    const rules = await this.prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: [{ serviceType: 'asc' }, { minProfit: 'asc' }],
      select: {
        serviceType: true,
        minProfit: true,
        maxProfit: true,
        rate: true,
      },
    });

    // Group by service type
    const grouped: Record<string, any[]> = {};

    for (const rule of rules) {
      if (!grouped[rule.serviceType]) {
        grouped[rule.serviceType] = [];
      }

      grouped[rule.serviceType].push({
        minProfit: rule.minProfit,
        maxProfit: rule.maxProfit,
        rate: rule.rate,
      });
    }

    return grouped as any;
  }

  /**
   * Validate that commission rules have no gaps or overlaps.
   * This should be called when creating/updating rules.
   */
  async validateCommissionRules(serviceType: ServiceType): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const rules = await this.prisma.commissionRule.findMany({
      where: { serviceType, isActive: true },
      orderBy: { minProfit: 'asc' },
    });

    const errors: string[] = [];

    // Check for gaps and overlaps
    for (let i = 0; i < rules.length - 1; i++) {
      const current = rules[i];
      const next = rules[i + 1];

      // Check for overlap
      if (current.maxProfit > next.minProfit) {
        errors.push(
          `Overlap detected: Rule ${i + 1} [${current.minProfit}-${current.maxProfit}] overlaps with Rule ${i + 2} [${next.minProfit}-${next.maxProfit}]`,
        );
      }

      // Check for gap
      if (current.maxProfit < next.minProfit) {
        errors.push(
          `Gap detected: No rule covers profit range [${current.maxProfit}-${next.minProfit}]`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
