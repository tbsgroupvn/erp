// ============================================
// DELIVERY TYPES — Delivery, Vehicle, Dispatch
// ============================================

import { Branch } from './enums';

/** Delivery status values */
export type DeliveryStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'PICKED_UP'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'FAILED';

/** Full Delivery entity */
export interface Delivery {
  id: string;
  code: string;
  orderId: string;
  driverId: string | null;
  vehicleId: string | null;
  branch: Branch;

  // Recipient info
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;

  // Status & timeline
  status: DeliveryStatus;
  scheduledAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  podImageUrl: string | null;
  signatureUrl: string | null;

  // COD
  codAmount: number;
  codCollected: boolean;
  codCollectedAt: string | null;
  codReceiptUrl: string | null;

  failReason: string | null;
  note: string | null;
  dispatchedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Vehicle entity */
export interface Vehicle {
  id: string;
  plateNumber: string;
  type: 'TRUCK' | 'VAN' | 'MOTORCYCLE';
  capacity: number | null;
  branch: Branch;
  isActive: boolean;
  note: string | null;
  createdAt: string;
}

/** DTO for dispatching a delivery */
export interface DispatchDto {
  orderId: string;
  driverId: string;
  vehicleId: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  scheduledAt?: string;
  codAmount?: number;
  note?: string;
}
