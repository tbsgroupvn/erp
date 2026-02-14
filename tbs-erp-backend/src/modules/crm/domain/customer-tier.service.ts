import { Injectable, Logger } from '@nestjs/common';
import { CustomerTier } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DEPOSIT_RATE,
  TIER_ORDER_THRESHOLDS,
  TIER_REVENUE_THRESHOLDS,
} from '@common/constants/customer-tier.enum';

export interface TierEvaluationResult {
  currentTier: CustomerTier;
  recommendedTier: CustomerTier;
  shouldUpgrade: boolean;
  depositRate: number;
  creditLimit: number;
}

/**
 * Credit limits per tier in VND.
 */
const CREDIT_LIMITS: Record<CustomerTier, number> = {
  [CustomerTier.NEW]: 0,
  [CustomerTier.REGULAR]: 50_000_000, // 50M
  [CustomerTier.VIP]: 200_000_000, // 200M
  [CustomerTier.STRATEGIC]: 500_000_000, // 500M
};

@Injectable()
export class CustomerTierService {
  private readonly logger = new Logger(CustomerTierService.name);

  /**
   * Evaluate the appropriate tier for a customer based on their order
   * and revenue history. STRATEGIC tier is manual-only and never auto-assigned.
   */
  evaluateTier(customer: {
    tier: CustomerTier;
    totalOrders: number;
    totalRevenue: Decimal | number;
  }): TierEvaluationResult {
    const revenue =
      typeof customer.totalRevenue === 'number'
        ? customer.totalRevenue
        : customer.totalRevenue.toNumber();

    const orders = customer.totalOrders;

    // STRATEGIC is manual-only; never auto-downgrade from it
    if (customer.tier === CustomerTier.STRATEGIC) {
      return {
        currentTier: CustomerTier.STRATEGIC,
        recommendedTier: CustomerTier.STRATEGIC,
        shouldUpgrade: false,
        depositRate: this.getDepositRate(CustomerTier.STRATEGIC),
        creditLimit: this.getCreditLimit(CustomerTier.STRATEGIC),
      };
    }

    let recommendedTier: CustomerTier;

    if (
      orders >= TIER_ORDER_THRESHOLDS[CustomerTier.VIP] &&
      revenue >= TIER_REVENUE_THRESHOLDS[CustomerTier.VIP]
    ) {
      recommendedTier = CustomerTier.VIP;
    } else if (orders >= TIER_ORDER_THRESHOLDS[CustomerTier.REGULAR]) {
      recommendedTier = CustomerTier.REGULAR;
    } else {
      recommendedTier = CustomerTier.NEW;
    }

    const tierRank: Record<CustomerTier, number> = {
      [CustomerTier.NEW]: 0,
      [CustomerTier.REGULAR]: 1,
      [CustomerTier.VIP]: 2,
      [CustomerTier.STRATEGIC]: 3,
    };

    const shouldUpgrade = tierRank[recommendedTier] > tierRank[customer.tier];

    this.logger.debug(
      `Tier evaluation for customer: orders=${orders}, revenue=${revenue}, ` +
        `current=${customer.tier}, recommended=${recommendedTier}, upgrade=${shouldUpgrade}`,
    );

    return {
      currentTier: customer.tier,
      recommendedTier,
      shouldUpgrade,
      depositRate: this.getDepositRate(recommendedTier),
      creditLimit: this.getCreditLimit(recommendedTier),
    };
  }

  /**
   * Returns the deposit rate percentage for a given tier.
   * NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
   */
  getDepositRate(tier: CustomerTier): number {
    return DEPOSIT_RATE[tier];
  }

  /**
   * Returns the credit limit (VND) for a given tier.
   */
  getCreditLimit(tier: CustomerTier): number {
    return CREDIT_LIMITS[tier];
  }
}
