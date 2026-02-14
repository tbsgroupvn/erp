import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

export interface AgingSummary {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

export interface AgingTrend {
  snapshotDate: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

export interface CustomerAgingResult {
  customerId: string;
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
    totalOutstanding: number;
    totalOverdue: number;
  };
  counts: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  maxOverdueDays: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shouldBlock: boolean;
  blockReason?: string;
}

export interface HighRiskCustomer {
  id: string;
  snapshotDate: string;
  customerId: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
  totalOverdue: number;
  maxOverdueDays: number;
  riskLevel: string;
  shouldBlock: boolean;
  blockReason?: string;
  customer?: {
    code: string;
    fullName: string;
    phone: string;
    email?: string;
    isBlocked: boolean;
    creditLimit: number;
    currentDebt: number;
  };
}

export const arAgingApi = {
  /**
   * GET /ar/aging/summary
   * Get company-wide aging summary
   */
  getSummary: (date?: string) =>
    apiClient
      .get<BaseResponse<AgingSummary>>('/ar/aging/summary', {
        params: date ? { date } : undefined,
      })
      .then((r) => r.data.data),

  /**
   * GET /ar/aging/trends
   * Get historical aging trends (last N days)
   */
  getTrends: (days: number = 30) =>
    apiClient
      .get<BaseResponse<AgingTrend[]>>('/ar/aging/trends', {
        params: { days },
      })
      .then((r) => r.data.data),

  /**
   * GET /ar/aging/high-risk
   * Get list of high-risk customers
   */
  getHighRiskCustomers: () =>
    apiClient
      .get<BaseResponse<HighRiskCustomer[]>>('/ar/aging/high-risk')
      .then((r) => r.data.data),

  /**
   * GET /ar/aging/customer/:customerId
   * Get current aging for a specific customer
   */
  getCustomerAging: (customerId: string) =>
    apiClient
      .get<BaseResponse<CustomerAgingResult>>(`/ar/aging/customer/${customerId}`)
      .then((r) => r.data.data),

  /**
   * GET /ar/aging/customer/:customerId/trend
   * Get aging trend for a customer (last N days)
   */
  getCustomerAgingTrend: (customerId: string, days?: number) =>
    apiClient
      .get<BaseResponse<any[]>>(`/ar/aging/customer/${customerId}/trend`, {
        params: days ? { days } : undefined,
      })
      .then((r) => r.data.data),
};
