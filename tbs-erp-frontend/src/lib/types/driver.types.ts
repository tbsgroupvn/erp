// ============================================
// DRIVER TYPES — Driver, DriverPerformance
// ============================================

import { Branch, DriverStatus } from './enums';

export interface Driver {
  id: string;
  employeeId?: string;
  fullName: string;
  phone: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  licenseType?: string;
  vehicleId?: string;
  branch: Branch;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverDto {
  employeeId?: string;
  fullName: string;
  phone: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  licenseType?: string;
  vehicleId?: string;
  branch: Branch;
}

export interface UpdateDriverDto extends Partial<CreateDriverDto> {}

export interface DriverQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DriverStatus;
  branch?: Branch;
}

export interface DriverPerformance {
  totalDeliveries: number;
  onTimeRate: number;
  codCollected: number;
  averageRating?: number;
}
