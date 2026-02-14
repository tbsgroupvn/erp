// ============================================
// PACKAGE TYPES — Warehouse packages
// ============================================

/** Warehouse CN status values */
export type WarehouseCNStatus = 'RECEIVED' | 'CHECKED' | 'PACKED' | 'SHIPPED';

/** Warehouse VN status values */
export type WarehouseVNStatus = 'RECEIVED' | 'SORTED' | 'READY' | 'DELIVERED';

/** Full Package entity */
export interface Package {
  id: string;
  code: string;
  orderId: string;
  trackingNumberCN: string | null;
  description: string | null;
  imageUrls: string[];

  // Dimensions & weights (filled by warehouse CN)
  actualWeight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  volumetricWeight: number | null;
  chargeableWeight: number | null;

  // Statuses
  warehouseCNStatus: WarehouseCNStatus | null;
  warehouseVNStatus: WarehouseVNStatus | null;

  // Timestamps
  receivedCNAt: string | null;
  receivedCNBy: string | null;
  packedAt: string | null;
  receivedVNAt: string | null;
  receivedVNBy: string | null;
  deliveredAt: string | null;

  containerId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO for receiving a package at warehouse CN */
export interface ReceivePackageDto {
  orderId: string;
  trackingNumberCN?: string;
  description?: string;
  imageUrls?: string[];
  note?: string;
}

/** DTO for measuring a package (dimensions + weight) */
export interface MeasurePackageDto {
  actualWeight: number;
  length: number;
  width: number;
  height: number;
  note?: string;
}
