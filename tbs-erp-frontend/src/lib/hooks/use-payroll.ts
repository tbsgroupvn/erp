'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { payrollApi } from '@/lib/api/payroll.api';
import type { PayrollQueryParams } from '@/lib/types/payroll.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params?: PayrollQueryParams) => [...payrollKeys.lists(), params] as const,
  summaries: () => [...payrollKeys.all, 'summary'] as const,
  summary: (month: number, year: number) => [...payrollKeys.summaries(), month, year] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePayrollList(params?: PayrollQueryParams) {
  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn: () => payrollApi.list(params),
  });
}

export function usePayrollSummary(month: number, year: number) {
  return useQuery({
    queryKey: payrollKeys.summary(month, year),
    queryFn: () => payrollApi.summary({ month, year }),
    enabled: !!month && !!year,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCalculatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { month: number; year: number }) => payrollApi.calculate(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.summaries() });
      toast.success('Tính lương thành công');
    },
    onError: () => {
      toast.error('Không thể tính lương');
    },
  });
}

export function useApprovePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { month: number; year: number }) => payrollApi.approve(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.summaries() });
      toast.success('Duyệt bảng lương thành công');
    },
    onError: () => {
      toast.error('Không thể duyệt bảng lương');
    },
  });
}
