import { useQuery } from '@tanstack/react-query';
import { arAgingApi } from '@/lib/api/ar-aging.api';

export const arAgingKeys = {
  all: ['ar-aging'] as const,
  summary: (date?: string) => [...arAgingKeys.all, 'summary', date] as const,
  trends: (days: number) => [...arAgingKeys.all, 'trends', days] as const,
  customerAging: (customerId: string) =>
    [...arAgingKeys.all, 'customer', customerId] as const,
  customerTrend: (customerId: string, days: number) =>
    [...arAgingKeys.all, 'customer-trend', customerId, days] as const,
  highRisk: () => [...arAgingKeys.all, 'high-risk'] as const,
};

/**
 * Get company-wide aging summary
 */
export function useAgingSummary(date?: string) {
  return useQuery({
    queryKey: arAgingKeys.summary(date),
    queryFn: () => arAgingApi.getSummary(date),
  });
}

/**
 * Get historical aging trends (last N days)
 */
export function useAgingTrends(days: number = 30) {
  return useQuery({
    queryKey: arAgingKeys.trends(days),
    queryFn: () => arAgingApi.getTrends(days),
  });
}

/**
 * Get current aging for a specific customer
 */
export function useCustomerAging(customerId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: arAgingKeys.customerAging(customerId),
    queryFn: () => arAgingApi.getCustomerAging(customerId),
    enabled: !!customerId && enabled,
  });
}

/**
 * Get aging trend for a customer (last N days)
 */
export function useCustomerAgingTrend(
  customerId: string,
  days: number = 30,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: arAgingKeys.customerTrend(customerId, days),
    queryFn: () => arAgingApi.getCustomerAgingTrend(customerId, days),
    enabled: !!customerId && enabled,
  });
}

/**
 * Get list of high-risk customers
 */
export function useHighRiskCustomers() {
  return useQuery({
    queryKey: arAgingKeys.highRisk(),
    queryFn: () => arAgingApi.getHighRiskCustomers(),
  });
}
