'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryApi } from '@/lib/api/inventory.api';
import type {
  InventoryQueryParams,
  CreateStockItemDto,
  CreateStockMovementDto,
} from '@/lib/types/inventory.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const inventoryKeys = {
  all: ['inventory'] as const,
  stocks: () => [...inventoryKeys.all, 'stock'] as const,
  stockList: (params?: InventoryQueryParams) => [...inventoryKeys.stocks(), params] as const,
  stockDetail: (id: string) => [...inventoryKeys.stocks(), 'detail', id] as const,
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,
  movements: () => [...inventoryKeys.all, 'movements'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCurrentStock(params?: InventoryQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.stockList(params),
    queryFn: () => inventoryApi.listStock(params),
  });
}

export function useStockItem(id: string) {
  return useQuery({
    queryKey: inventoryKeys.stockDetail(id),
    queryFn: () => inventoryApi.getStockById(id),
    enabled: !!id,
  });
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: inventoryKeys.alerts(),
    queryFn: () => inventoryApi.lowStockAlerts(),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockItemDto) => inventoryApi.createStockItem(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.stocks() });
      toast.success('Thêm vật tư thành công');
    },
    onError: () => {
      toast.error('Không thể thêm vật tư');
    },
  });
}

export function useCreateStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockMovementDto) => inventoryApi.createMovement(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.stocks() });
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() });
      qc.invalidateQueries({ queryKey: inventoryKeys.alerts() });
      toast.success('Ghi nhận biến động kho thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận biến động kho');
    },
  });
}
