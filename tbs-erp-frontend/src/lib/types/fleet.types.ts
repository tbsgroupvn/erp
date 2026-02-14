import type { QueryParams } from './common.types';
import type { Branch, MaintenanceType, VehicleStatus, VehicleType } from './enums';

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: VehicleType;
  brand: string;
  model: string;
  capacityKg: number;
  status: VehicleStatus;
  branch: Branch;
  insuranceExpiry?: string;
  registrationExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  date: string;
  nextDate?: string;
  createdAt: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  liters: number;
  cost: number;
  odometer: number;
  date: string;
  createdAt: string;
}

export interface VehicleQueryParams extends QueryParams {
  type?: VehicleType;
  status?: VehicleStatus;
  branch?: Branch;
}

export interface CreateVehicleDto {
  plateNumber: string;
  type: VehicleType;
  brand: string;
  model: string;
  capacityKg: number;
  branch: Branch;
  insuranceExpiry?: string;
  registrationExpiry?: string;
}

export type UpdateVehicleDto = Partial<CreateVehicleDto> & { status?: VehicleStatus };

export interface CreateMaintenanceDto {
  type: MaintenanceType;
  description: string;
  cost: number;
  date: string;
  nextDate?: string;
}

export interface CreateFuelRecordDto {
  liters: number;
  cost: number;
  odometer: number;
  date: string;
}
