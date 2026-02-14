import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  Vehicle,
  VehicleQueryParams,
  CreateVehicleDto,
  UpdateVehicleDto,
  MaintenanceRecord,
  FuelRecord,
  CreateMaintenanceDto,
  CreateFuelRecordDto,
} from '@/lib/types/fleet.types';

export const fleetApi = {
  /** GET /vehicles */
  list: (params?: VehicleQueryParams) =>
    apiClient
      .get<PaginatedResponse<Vehicle>>('/vehicles', { params })
      .then((r) => r.data),

  /** GET /vehicles/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Vehicle>>(`/vehicles/${id}`)
      .then((r) => r.data.data),

  /** POST /vehicles */
  create: (data: CreateVehicleDto) =>
    apiClient
      .post<BaseResponse<Vehicle>>('/vehicles', data)
      .then((r) => r.data.data),

  /** PATCH /vehicles/:id */
  update: (id: string, data: UpdateVehicleDto) =>
    apiClient
      .patch<BaseResponse<Vehicle>>(`/vehicles/${id}`, data)
      .then((r) => r.data.data),

  /** GET /vehicles/:id/maintenance */
  listMaintenance: (id: string) =>
    apiClient
      .get<BaseResponse<MaintenanceRecord[]>>(`/vehicles/${id}/maintenance`)
      .then((r) => r.data.data),

  /** POST /vehicles/:id/maintenance */
  createMaintenance: (id: string, data: CreateMaintenanceDto) =>
    apiClient
      .post<BaseResponse<MaintenanceRecord>>(`/vehicles/${id}/maintenance`, data)
      .then((r) => r.data.data),

  /** GET /vehicles/:id/fuel */
  listFuelRecords: (id: string) =>
    apiClient
      .get<BaseResponse<FuelRecord[]>>(`/vehicles/${id}/fuel`)
      .then((r) => r.data.data),

  /** POST /vehicles/:id/fuel */
  createFuelRecord: (id: string, data: CreateFuelRecordDto) =>
    apiClient
      .post<BaseResponse<FuelRecord>>(`/vehicles/${id}/fuel`, data)
      .then((r) => r.data.data),
};
