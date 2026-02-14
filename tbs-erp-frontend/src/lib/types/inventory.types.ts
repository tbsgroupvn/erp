import type { QueryParams } from './common.types';
import type { StockMovementType } from './enums';

export interface StockItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentQty: number;
  minLevel: number;
  maxLevel: number;
  location: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  stockItem?: StockItem;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  note?: string;
  createdBy: string;
  createdByUser?: { id: string; fullName: string };
  createdAt: string;
}

export interface LowStockAlert {
  stockItemId: string;
  code: string;
  name: string;
  currentQty: number;
  minLevel: number;
}

export interface InventoryQueryParams extends QueryParams {
  category?: string;
  location?: string;
}

export interface CreateStockItemDto {
  code: string;
  name: string;
  unit: string;
  minLevel: number;
  maxLevel: number;
  location: string;
  category: string;
}

export interface CreateStockMovementDto {
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  note?: string;
}
