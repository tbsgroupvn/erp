'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { codApi } from '@/lib/api/cod.api';
import type { RecordCODCollectionDto, CODQueryParams } from '@/lib/api/cod.api';

export const codKeys = {
  all: ['cod'] as const,
  lists: () => [...codKeys.all, 'list'] as const,
  list: (params?: CODQueryParams) => [...codKeys.lists(), params] as const,
  driverDay: (driverId: string, date: string) =>
    [...codKeys.all, 'driver', driverId, date] as const,
};

export function useCODList(params?: CODQueryParams) {
  return useQuery({
    queryKey: codKeys.list(params),
    queryFn: () => codApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useDriverCODCollections(driverId: string, date: string) {
  return useQuery({
    queryKey: codKeys.driverDay(driverId, date),
    queryFn: () => codApi.getDriverCollections(driverId, date),
    enabled: !!driverId && !!date,
  });
}

export function useRecordCODCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordCODCollectionDto) => codApi.recordCollection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: codKeys.all });
      toast.success('Ghi nhận thu COD thành công');
    },
  });
}

export function useConfirmRemittance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ driverId, date, amount }: { driverId: string; date: string; amount: number }) =>
      codApi.confirmRemittance(driverId, date, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: codKeys.all });
      toast.success('Xác nhận nộp tiền COD thành công');
    },
  });
}
