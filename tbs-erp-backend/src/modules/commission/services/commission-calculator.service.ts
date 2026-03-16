import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { ServiceType } from '@prisma/client';

/** Cache TTL for commission rules (30 minutes in milliseconds). */
const COMMISSION_RULES_CACHE_TTL_MS = 30 * 60 * 1000;

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
  costAdjustments?: Array<{
    amount: number | { toNumber: () => number };
  }>;
}

/**
 * Service responsible for calculating commission based on profit margins.
 * Uses tiered commission rules stored in the database.
 */
@Injectable()
export class CommissionCalculatorService {
  private readonly logger = new Logger(CommissionCalculatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate commission for an order based on profit margin.
   *
   * @param order - Order with cost allocations
   * @returns Commission calculation result or null if no applicable rule
   */
  async calculateCommission(order: OrderWithCosts): Promise<CommissionCalculationResult | null> {
    // Calculate revenue from order total amount
    const revenue =
      typeof order.totalAmount === 'number' ? order.totalAmount : order.totalAmount.toNumber();

    // Calculate total costs from cost allocations using integer arithmetic (VND)
    // to avoid floating-point precision issues with financial calculations
    const allocationCost = order.costAllocations.reduce((sum, alloc) => {
      const amount =
        typeof alloc.allocatedAmount === 'number'
          ? alloc.allocatedAmount
          : alloc.allocatedAmount.toNumber();
      return sum + amount;
    }, 0);

    // Include approved cost adjustments (late-arriving costs)
    const adjustmentCost = (order.costAdjustments ?? []).reduce((sum, adj) => {
      const amount =
        typeof adj.amount === 'number' ? adj.amount : adj.amount.toNumber();
      return sum + amount;
    }, 0);

    const totalCost = allocationCost + adjustmentCost;

    // Calculate net profit (revenue - cost), rounded to avoid floating-point drift
    const netProfit = Math.round((revenue - totalCost) * 100) / 100;

    this.logger.debug(
      `Order ${order.code}: revenue=${revenue}, cost=${totalCost}, profit=${netProfit}`,
    );

    // Query CommissionRule to get applicable rate
    const rule = await this.getApplicableCommissionRule(order.serviceType, netProfit);

    if (!rule) {
      this.logger.log(`No commission rule found for ${order.serviceType} with profit ${netProfit}`);
      return null;
    }

    // Calculate commission amount (never negative), rounded to avoid floating-point drift
    const commissionAmount = Math.max(0, Math.round(netProfit * Number(rule.rate) * 100) / 100);

    this.logger.log(
      `Commission rule applied: ${order.serviceType} profit ${netProfit} → rate ${Number(rule.rate) * 100}% → amount ${commissionAmount}`,
    );

    return {
      revenue,
      cost: totalCost,
      profit: netProfit,
      rate: Number(rule.rate),
      amount: commissionAmount,
    };
  }

  /**
   * Get the applicable commission rule based on service type and profit margin.
   * Uses tiered rate system based on profit ranges.
   * Active rules are cached for 30 minutes since they rarely change.
   *
   * @param serviceType - Type of service (VCT, MHH, UTXNK, LCLCN)
   * @param profit - Net profit amount
   * @returns Commission rule or null if no matching rule
   */
  private async getApplicableCommissionRule(serviceType: ServiceType, profit: number) {
    // Fetch all active rules from cache (or DB on miss)
    const allRules = await this.cacheService.getOrSet(
      'commission-rules:active',
      () =>
        this.prisma.commissionRule.findMany({
          where: { isActive: true },
          orderBy: { minProfit: 'desc' },
        }),
      COMMISSION_RULES_CACHE_TTL_MS,
    );

    // Filter in-memory for the specific service type and profit range
    const rule = allRules.find(
      (r) =>
        r.serviceType === serviceType &&
        Number(r.minProfit) <= profit &&
        Number(r.maxProfit) > profit,
    );

    if (rule) {
      this.logger.debug(
        `Found commission rule: ${serviceType} [${rule.minProfit}-${rule.maxProfit}] @ ${Number(rule.rate) * 100}%`,
      );
    }

    return rule ?? null;
  }

  /**
   * Get all active commission rules grouped by service type.
   * Useful for displaying tier structure to users.
   * Results are cached for 30 minutes since rules rarely change.
   */
  async getCommissionTiers(): Promise<
    Record<ServiceType, Array<{ minProfit: number; maxProfit: number; rate: number }>>
  > {
    return this.cacheService.getOrSet(
      'commission-rules:tiers',
      async () => {
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
            minProfit: Number(rule.minProfit),
            maxProfit: Number(rule.maxProfit),
            rate: Number(rule.rate),
          });
        }

        return grouped as any;
      },
      COMMISSION_RULES_CACHE_TTL_MS,
    );
  }

  /**
   * Validate that commission rules have no gaps or overlaps.
   * This should be called when creating/updating rules.
   * Invalidates the commission rules cache after validation.
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
      if (Number(current.maxProfit) > Number(next.minProfit)) {
        errors.push(
          `Overlap detected: Rule ${i + 1} [${current.minProfit}-${current.maxProfit}] overlaps with Rule ${i + 2} [${next.minProfit}-${next.maxProfit}]`,
        );
      }

      // Check for gap
      if (Number(current.maxProfit) < Number(next.minProfit)) {
        errors.push(
          `Gap detected: No rule covers profit range [${current.maxProfit}-${next.minProfit}]`,
        );
      }
    }

    // Invalidate commission rules cache since rules may have changed
    await this.cacheService.invalidateByPrefix('commission-rules:');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Invalidate all commission rules caches.
   * Call this when commission rules are created, updated, or deleted.
   */
  async invalidateRulesCache(): Promise<void> {
    await this.cacheService.invalidateByPrefix('commission-rules:');
    this.logger.debug('Commission rules cache invalidated');
  }
}
