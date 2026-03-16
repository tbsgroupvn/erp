// ============================================
// CONTAINER TYPES — Container management
// ============================================

import { QueryParams } from './common.types';
import { ShippingRoute } from './enums';

/** Full Container entity */
export interface Container {
  id: string;
  code: string;
  shippingRoute: ShippingRoute;
  status:
    | 'PLANNING'
    | 'LOADING'
    | 'IN_TRANSIT'
    | 'ON_HOLD_BORDER'
    | 'ARRIVED'
    | 'CUSTOMS'
    | 'CUSTOMS_HOLD'
    | 'COMPLETED';
  origin: string | null;
  destination: string | null;

  // Carrier info
  carrier: string | null;
  bookingRef: string | null;
  sealNumber: string | null;
  vesselName: string | null;

  // Container & B/L info (thông tin container thực tế và vận đơn)
  containerNumber: string | null; // ISO container number: MSKU1234567
  containerSize: string | null;   // 20DC | 40DC | 40HC | LCL
  blNumber: string | null;        // Số vận đơn (B/L hoặc AWB)
  voyageNumber: string | null;    // Số chuyến tàu
  portOfLoading: string | null;   // Cảng xếp hàng
  portOfDischarge: string | null; // Cảng dỡ hàng
  customsOfficeCode: string | null; // Cửa khẩu khai báo
  declaredVgm: number | null;     // VGM (kg)

  // Weight & capacity
  totalPackages: number;
  totalWeight: number;
  maxCapacity: number | null;
  fillRate: number | null;

  // Timeline
  estimatedDepartureAt: string | null;
  actualDepartureAt: string | null;
  estimatedArrivalAt: string | null;
  actualArrivalAt: string | null;
  customsClearedAt: string | null;

  // Customs split
  clearedPackageCount: number;
  heldPackageCount: number;
  customsHoldReason: string | null;
  customsHoldAt: string | null;
  customsHoldResolvedAt: string | null;

  // D/O — Lệnh giao hàng
  doNumber: string | null;
  doReceivedAt: string | null;
  doExpiryAt: string | null;
  doIssuedBy: string | null;

  // Free time / Demurrage
  freeTimeExpiry: string | null;
  demurrageStartAt: string | null;
  demurrageNote: string | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** DTO for creating a new container */
export interface CreateContainerDto {
  shippingRoute: ShippingRoute;
  origin?: string;
  destination?: string;
  carrier?: string;
  bookingRef?: string;
  sealNumber?: string;
  vesselName?: string;
  maxCapacity?: number;
  estimatedDepartureAt?: string;
  estimatedArrivalAt?: string;
  // New fields
  containerNumber?: string;
  containerSize?: string;
  blNumber?: string;
  voyageNumber?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  customsOfficeCode?: string;
  declaredVgm?: number;
}

/** D/O recording DTO */
export interface RecordDeliveryOrderDto {
  doNumber: string;
  doReceivedAt?: string;
  doExpiryAt?: string;
  doIssuedBy?: string;
}

/** Free time update DTO */
export interface UpdateFreeTimeDto {
  freeTimeExpiry: string;
  demurrageNote?: string;
}

/** Container timeline response */
export interface ContainerTimeline {
  containerId: string;
  containerCode: string;
  status: Container['status'];
  milestones: Array<{
    status: string;
    label: string;
    icon: string;
    estimatedDate: string | null;
    actualDate: string | null;
    isDone: boolean;
  }>;
  trackingEvents: Array<{
    id: string;
    eventType: string;
    eventTimestamp: string;
    description: string;
    location: string | null;
    createdBy: string;
  }>;
  doInfo: {
    doNumber: string;
    doReceivedAt: string | null;
    doExpiryAt: string | null;
    doIssuedBy: string | null;
    isExpired: boolean;
    daysUntilExpiry: number | null;
  } | null;
  freeTimeInfo: {
    freeTimeExpiry: string;
    demurrageStartAt: string | null;
    demurrageNote: string | null;
    isExpired: boolean;
    daysUntilExpiry: number;
  } | null;
}

/** Container cost breakdown response */
export interface ContainerCostBreakdown {
  containerId: string;
  containerCode: string;
  totalWeight: number;
  totalPackages: number;
  costGroups: Record<string, {
    totalVND: number;
    items: Array<{
      id: string;
      costType: string;
      amount: number;
      currency: string;
      description: string | null;
      invoiceRef: string | null;
      note: string | null;
      createdAt: string;
    }>;
  }>;
  grandTotalVND: number;
  costPerKg: number | null;
  itemCount: number;
}

/** Weight reconciliation response */
export interface ContainerWeightReconciliation {
  containerId: string;
  containerCode: string;
  totalPackages: number;
  scannedCount: number;
  pendingCount: number;
  totalCNWeight: number;
  totalVNWeight: number;
  weightDiff: number;
  packagesWithSignificantDiff: number;
  packages: Array<{
    packageId: string;
    packageCode: string;
    orderId: string;
    orderCode: string | null;
    customerName: string | null;
    customerCode: string | null;
    cnChargeableWeight: number;
    cnActualWeight: number | null;
    vnWeight: number | null;
    diff: number | null;
    diffPct: number | null;
    hasSignificantDiff: boolean;
  }>;
}

/** Customs split status response */
export interface ContainerCustomsSplitStatus {
  containerId: string;
  containerCode: string;
  containerStatus: Container['status'];
  totalPackages: number;
  clearedPackages: Array<{ id: string; code: string; orderId: string; orderCode: string; customerName: string }>;
  heldPackages: Array<{ id: string; code: string; orderId: string; orderCode: string; customerName: string }>;
  confiscatedPackages: Array<{ id: string; code: string; orderId: string; orderCode: string; customerName: string }>;
  reason: string | null;
  holdAt: string | null;
  resolvedAt: string | null;
}

/** Query params for container listing */
export interface ContainerQueryParams extends QueryParams {
  status?: Container['status'];
  shippingRoute?: ShippingRoute;
  dateFrom?: string;
  dateTo?: string;
}

/** Consolidation plan suggestion from backend */
export interface ConsolidationPlanSuggestion {
  shippingRoute: ShippingRoute;
  suggestedContainers: number;
  totalWeight: number;
  totalPackages: number;
  fillRate: number;
  packages: Array<{
    id: string;
    code: string;
    chargeableWeight: number;
    orderId: string;
  }>;
}
