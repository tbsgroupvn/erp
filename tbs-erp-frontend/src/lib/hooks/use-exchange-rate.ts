'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  exchangeRateApi,
  type SetExchangeRateDto,
  type ExchangeRateQueryParams,
} from '@/lib/api/exchange-rate.api';
import type { Currency } from '@/lib/types/enums';

export const exchangeRateKeys = {
  all: ['exchange-rate'] as const,
  current: (from: Currency, to: Currency) =>
    [...exchangeRateKeys.all, 'current', from, to] as const,
  history: (params?: ExchangeRateQueryParams) =>
    [...exchangeRateKeys.all, 'history', params] as const,
  active: () => [...exchangeRateKeys.all, 'active'] as const,
};

export function useCurrentRate(from: Currency, to: Currency) {
  return useQuery({
    queryKey: exchangeRateKeys.current(from, to),
    queryFn: () => exchangeRateApi.getCurrentRate(from, to),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000, // exchange rates update daily — 5 min cache
  });
}

export function useExchangeRateHistory(params?: ExchangeRateQueryParams) {
  return useQuery({
    queryKey: exchangeRateKeys.history(params),
    queryFn: () => exchangeRateApi.getHistory(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveRates() {
  return useQuery({
    queryKey: exchangeRateKeys.active(),
    queryFn: () => exchangeRateApi.getActive(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SetExchangeRateDto) => exchangeRateApi.setRate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exchangeRateKeys.all });
      toast.success('Cập nhật tỷ giá thành công');
    },
  });
}

export function useConvertCurrency() {
  return useMutation({
    mutationFn: ({
      from,
      to,
      amount,
    }: {
      from: Currency;
      to: Currency;
      amount: number;
    }) => exchangeRateApi.convert(from, to, amount),
  });
}

export function useSyncVietcombank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => exchangeRateApi.syncVietcombank(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exchangeRateKeys.all });
      toast.success('Đồng bộ tỷ giá Vietcombank thành công');
    },
  });
}
