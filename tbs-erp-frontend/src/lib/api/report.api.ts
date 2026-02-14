import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

export interface SalesReportItem {
  employeeId: string;
  employeeName: string;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  conversionRate: number;
}

export interface SalesReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  items: SalesReportItem[];
}

export interface FinancialReportSummary {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  receivableTotal: number;
  payableTotal: number;
  cashBalance: number;
  revenueByMonth: { month: string; amount: number }[];
  expenseByCategory: { category: string; amount: number }[];
  profitByMonth: { month: string; amount: number }[];
}

export interface ReportQueryParams {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  employeeId?: string;
  teamId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export const reportApi = {
  /** GET /reports/sales */
  getSalesReport: (params?: ReportQueryParams) =>
    apiClient
      .get<BaseResponse<SalesReportSummary>>('/reports/sales', { params })
      .then((r) => r.data.data),

  /** GET /reports/financial */
  getFinancialReport: (params?: ReportQueryParams) =>
    apiClient
      .get<BaseResponse<FinancialReportSummary>>('/reports/financial', {
        params,
      })
      .then((r) => r.data.data),
};
