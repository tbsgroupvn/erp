'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fleetApi } from '@/lib/api/fleet.api';
import type {
  VehicleQueryParams,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateMaintenanceDto,
  CreateFuelRecordDto,
} from '@/lib/types/fleet.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const fleetKeys = {
  all: ['fleet'] as const,
  lists: () => [...fleetKeys.all, 'list'] as const,
  list: (params?: VehicleQueryParams) => [...fleetKeys.lists(), params] as const,
  details: () => [...fleetKeys.all, 'detail'] as const,
  detail: (id: string) => [...fleetKeys.details(), id] as const,
  maintenance: (id: string) => [...fleetKeys.all, 'maintenance', id] as const,
  fuel: (id: string) => [...fleetKeys.all, 'fuel', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useVehicles(params?: VehicleQueryParams) {
  return useQuery({
    queryKey: fleetKeys.list(params),
    queryFn: () => fleetApi.list(params),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: fleetKeys.detail(id),
    queryFn: () => fleetApi.getById(id),
    enabled: !!id,
  });
}

export function useVehicleMaintenance(id: string) {
  return useQuery({
    queryKey: fleetKeys.maintenance(id),
    queryFn: () => fleetApi.listMaintenance(id),
    enabled: !!id,
  });
}

export function useVehicleFuelRecords(id: string) {
  return useQuery({
    queryKey: fleetKeys.fuel(id),
    queryFn: () => fleetApi.listFuelRecords(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVehicleDto) => fleetApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fleetKeys.lists() });
      toast.success('Thêm phương tiện thành công');
    },
    onError: () => {
      toast.error('Không thể thêm phương tiện');
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDto }) =>
      fleetApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: fleetKeys.detail(id) });
      qc.invalidateQueries({ queryKey: fleetKeys.lists() });
      toast.success('Cập nhật phương tiện thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật phương tiện');
    },
  });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, data }: { vehicleId: string; data: CreateMaintenanceDto }) =>
      fleetApi.createMaintenance(vehicleId, data),
    onSuccess: (_data, { vehicleId }) => {
      qc.invalidateQueries({ queryKey: fleetKeys.maintenance(vehicleId) });
      toast.success('Lên lịch bảo dưỡng thành công');
    },
    onError: () => {
      toast.error('Không thể lên lịch bảo dưỡng');
    },
  });
}

export function useCreateFuelRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, data }: { vehicleId: string; data: CreateFuelRecordDto }) =>
      fleetApi.createFuelRecord(vehicleId, data),
    onSuccess: (_data, { vehicleId }) => {
      qc.invalidateQueries({ queryKey: fleetKeys.fuel(vehicleId) });
      toast.success('Ghi nhận nhiên liệu thành công');
    },
    onError: () => {
      toast.error('Không thể ghi nhận nhiên liệu');
    },
  });
}
