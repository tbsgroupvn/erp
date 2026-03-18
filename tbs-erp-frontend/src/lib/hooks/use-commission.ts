'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  commissionApi,
  type CreateCommissionRuleDto,
  type CommissionQueryParams,
} from '@/lib/api/commission.api';

export const commissionKeys = {
  all: ['commissions'] as const,
  rules: () => [...commissionKeys.all, 'rules'] as const,
  my: (params?: CommissionQueryParams) =>
    [...commissionKeys.all, 'my', params] as const,
  team: (params?: CommissionQueryParams) =>
    [...commissionKeys.all, 'team', params] as const,
  monthlyReport: (period: string) =>
    [...commissionKeys.all, 'monthly-report', period] as const,
};

export function useCommissionRules() {
  return useQuery({
    queryKey: commissionKeys.rules(),
    queryFn: () => commissionApi.listRules(),
    staleTime: 5 * 60 * 1000, // commission rules are near-static settings
  });
}

export function useCreateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommissionRuleDto) =>
      commissionApi.createRule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commissionKeys.rules() });
      toast.success('Tạo quy tắc hoa hồng thành công');
    },
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateCommissionRuleDto>;
    }) => commissionApi.updateRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commissionKeys.rules() });
      toast.success('Cập nhật quy tắc hoa hồng thành công');
    },
  });
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commissionApi.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commissionKeys.rules() });
      toast.success('Xóa quy tắc hoa hồng thành công');
    },
  });
}

export function useCalculateCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => commissionApi.calculate(period),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commissionKeys.all });
      toast.success('Tính hoa hồng thành công');
    },
  });
}

export function useMyCommissions(params?: CommissionQueryParams) {
  return useQuery({
    queryKey: commissionKeys.my(params),
    queryFn: () => commissionApi.getMyCommissions(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useTeamCommissions(params?: CommissionQueryParams) {
  return useQuery({
    queryKey: commissionKeys.team(params),
    queryFn: () => commissionApi.getTeamCommissions(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useApproveCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commissionApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commissionKeys.all });
      toast.success('Duyệt hoa hồng thành công');
    },
  });
}

export function useMonthlyCommissionReport(period: string) {
  return useQuery({
    queryKey: commissionKeys.monthlyReport(period),
    queryFn: () => commissionApi.getMonthlyReport(period),
    enabled: !!period,
    staleTime: 5 * 60 * 1000,
  });
}
