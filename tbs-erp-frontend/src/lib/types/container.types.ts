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
    | 'ARRIVED'
    | 'CUSTOMS'
    | 'COMPLETED';
  origin: string | null;
  destination: string | null;

  // Carrier info
  carrier: string | null;
  bookingRef: string | null;
  sealNumber: string | null;
  vesselName: string | null;

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
}

/** Query params for container listing */
export interface ContainerQueryParams extends QueryParams {
  status?: Container['status'];
  shippingRoute?: ShippingRoute;
  dateFrom?: string;
  dateTo?: string;
}
