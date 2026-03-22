'use client';

import { useQuery } from '@tanstack/react-query';
import { reportApi, type ReportQueryParams } from '@/lib/api/report.api';

export const reportKeys = {
  all: ['reports'] as const,
  sales: (params?: ReportQueryParams) =>
    [...reportKeys.all, 'sales', params] as const,
  financial: (params?: ReportQueryParams) =>
    [...reportKeys.all, 'financial', params] as const,
};

export function useSalesReport(params?: ReportQueryParams) {
  return useQuery({
    queryKey: reportKeys.sales(params),
    queryFn: () => reportApi.getSalesReport(params),
    staleTime: 5 * 60 * 1000, // reports are expensive queries — cache 5 min
  });
}

export function useFinancialReport(params?: ReportQueryParams) {
  return useQuery({
    queryKey: reportKeys.financial(params),
    queryFn: () => reportApi.getFinancialReport(params),
    staleTime: 5 * 60 * 1000,
  });
}
