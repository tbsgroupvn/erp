import { CustomerTier } from '@prisma/client';

/**
 * Deposit rate (%) required for each customer tier.
 */
export const DEPOSIT_RATE: Record<CustomerTier, number> = {
  [CustomerTier.NEW]: 100,
  [CustomerTier.REGULAR]: 70,
  [CustomerTier.VIP]: 50,
  [CustomerTier.STRATEGIC]: 30,
};

/**
 * Vietnamese labels for each customer tier.
 */
export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  [CustomerTier.NEW]: 'Khách mới',
  [CustomerTier.REGULAR]: 'Khách thường',
  [CustomerTier.VIP]: 'Khách VIP',
  [CustomerTier.STRATEGIC]: 'Đối tác chiến lược',
};

/**
 * Minimum annual revenue (VND) threshold to qualify for each tier.
 */
export const TIER_REVENUE_THRESHOLDS: Record<CustomerTier, number> = {
  [CustomerTier.NEW]: 0,
  [CustomerTier.REGULAR]: 0,
  [CustomerTier.VIP]: 500_000_000, // 500 triệu
  [CustomerTier.STRATEGIC]: 2_000_000_000, // 2 tỷ
};

/**
 * Minimum completed orders to qualify for each tier.
 */
export const TIER_ORDER_THRESHOLDS: Record<CustomerTier, number> = {
  [CustomerTier.NEW]: 0,
  [CustomerTier.REGULAR]: 10,
  [CustomerTier.VIP]: 20,
  [CustomerTier.STRATEGIC]: 50,
};

/**
 * Returns the deposit rate percentage for a given customer tier.
 */
export function getDepositRate(tier: CustomerTier): number {
  return DEPOSIT_RATE[tier];
}

/**
 * Calculates the deposit amount based on the total order amount and customer tier.
 */
export function calculateDepositAmount(totalAmount: number, tier: CustomerTier): number {
  const rate = DEPOSIT_RATE[tier];
  return Math.ceil((totalAmount * rate) / 100);
}

/**
 * Determines the appropriate tier based on completed orders and annual revenue.
 */
export function determineTier(completedOrders: number, annualRevenue: number): CustomerTier {
  if (
    completedOrders >= TIER_ORDER_THRESHOLDS[CustomerTier.STRATEGIC] &&
    annualRevenue >= TIER_REVENUE_THRESHOLDS[CustomerTier.STRATEGIC]
  ) {
    return CustomerTier.STRATEGIC;
  }
  if (
    completedOrders >= TIER_ORDER_THRESHOLDS[CustomerTier.VIP] &&
    annualRevenue >= TIER_REVENUE_THRESHOLDS[CustomerTier.VIP]
  ) {
    return CustomerTier.VIP;
  }
  if (completedOrders >= TIER_ORDER_THRESHOLDS[CustomerTier.REGULAR]) {
    return CustomerTier.REGULAR;
  }
  return CustomerTier.NEW;
}
