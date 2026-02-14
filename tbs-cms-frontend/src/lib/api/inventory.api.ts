import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  StockItem,
  StockMovement,
  InventoryQueryParams,
  CreateStockItemDto,
  CreateStockMovementDto,
  LowStockAlert,
} from '@/lib/types/inventory.types';

export const inventoryApi = {
  /** GET /inventory/stock */
  listStock: (params?: InventoryQueryParams) =>
    apiClient
      .get<PaginatedResponse<StockItem>>('/inventory/stock', { params })
      .then((r) => r.data),

  /** GET /inventory/stock/:id */
  getStockById: (id: string) =>
    apiClient
      .get<BaseResponse<StockItem>>(`/inventory/stock/${id}`)
      .then((r) => r.data.data),

  /** POST /inventory/stock */
  createStockItem: (data: CreateStockItemDto) =>
    apiClient
      .post<BaseResponse<StockItem>>('/inventory/stock', data)
      .then((r) => r.data.data),

  /** GET /inventory/alerts */
  lowStockAlerts: () =>
    apiClient
      .get<BaseResponse<LowStockAlert[]>>('/inventory/alerts')
      .then((r) => r.data.data),

  /** POST /inventory/movements */
  createMovement: (data: CreateStockMovementDto) =>
    apiClient
      .post<BaseResponse<StockMovement>>('/inventory/movements', data)
      .then((r) => r.data.data),

  /** GET /inventory/movements */
  listMovements: (params?: { stockItemId?: string; page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<StockMovement>>('/inventory/movements', { params })
      .then((r) => r.data),
};
