'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  debtNettingApi,
  type CreateDebtNettingDto,
  type DebtNettingQueryParams,
} from '@/lib/api/debt-netting.api';

export const debtNettingKeys = {
  all: ['debt-netting'] as const,
  lists: () => [...debtNettingKeys.all, 'list'] as const,
  list: (params?: DebtNettingQueryParams) =>
    [...debtNettingKeys.lists(), params] as const,
  opportunities: () => [...debtNettingKeys.all, 'opportunities'] as const,
};

export function useNettingOpportunities() {
  return useQuery({
    queryKey: debtNettingKeys.opportunities(),
    queryFn: () => debtNettingApi.findOpportunities(),
  });
}

export function useDebtNettingList(params?: DebtNettingQueryParams) {
  return useQuery({
    queryKey: debtNettingKeys.list(params),
    queryFn: () => debtNettingApi.list(params),
  });
}

export function useCreateDebtNetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDebtNettingDto) => debtNettingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: debtNettingKeys.all });
      toast.success('Tạo yêu cầu bù trừ thành công');
    },
    onError: () => {
      toast.error('Không thể tạo yêu cầu bù trừ');
    },
  });
}

export function useApproveDebtNetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtNettingApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: debtNettingKeys.all });
      toast.success('Duyệt bù trừ công nợ thành công');
    },
    onError: () => {
      toast.error('Không thể duyệt bù trừ');
    },
  });
}

export function useExecuteDebtNetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtNettingApi.execute(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: debtNettingKeys.all });
      toast.success('Thực hiện bù trừ thành công');
    },
    onError: () => {
      toast.error('Không thể thực hiện bù trừ');
    },
  });
}
