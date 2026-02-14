// ============================================
// WAREHOUSE TYPES — Re-export package/container related
// ============================================

// Warehouse types are spread across package.types.ts and container.types.ts.
// This module re-exports relevant items and adds warehouse-specific types.

export type { Package, ReceivePackageDto, MeasurePackageDto, WarehouseCNStatus, WarehouseVNStatus } from './package.types';
export type { Container, CreateContainerDto, ContainerQueryParams } from './container.types';

/** Warehouse inventory summary row */
export interface WarehouseInventory {
  warehouseId: string;
  warehouseName: string;
  totalPackages: number;
  totalWeight: number;
  pendingOutbound: number;
}
