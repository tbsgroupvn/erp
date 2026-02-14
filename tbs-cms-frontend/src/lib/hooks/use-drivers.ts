'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { driversApi } from '@/lib/api/drivers.api';
import type { DriverQueryParams, CreateDriverDto, UpdateDriverDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (params?: DriverQueryParams) => [...driverKeys.lists(), params] as const,
  details: () => [...driverKeys.all, 'detail'] as const,
  detail: (id: string) => [...driverKeys.details(), id] as const,
  performance: (id: string) => [...driverKeys.all, 'performance', id] as const,
  deliveries: (id: string) => [...driverKeys.all, 'deliveries', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDrivers(params?: DriverQueryParams) {
  return useQuery({
    queryKey: driverKeys.list(params),
    queryFn: () => driversApi.list(params as Record<string, unknown>),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: () => driversApi.getById(id),
    enabled: !!id,
  });
}

export function useDriverPerformance(id: string) {
  return useQuery({
    queryKey: driverKeys.performance(id),
    queryFn: () => driversApi.getPerformance(id),
    enabled: !!id,
  });
}

export function useDriverDeliveries(id: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: driverKeys.deliveries(id),
    queryFn: () => driversApi.getDeliveryHistory(id, params),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDriverDto) => driversApi.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      toast.success('Tạo tài xế thành công');
    },
    onError: () => {
      toast.error('Không thể tạo tài xế');
    },
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDriverDto }) =>
      driversApi.update(id, data as unknown as Record<string, unknown>),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: driverKeys.detail(id) });
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      toast.success('Cập nhật tài xế thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật tài xế');
    },
  });
}

export function useAssignVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, vehicleId }: { id: string; vehicleId: string }) =>
      driversApi.assignVehicle(id, vehicleId),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: driverKeys.detail(id) });
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      toast.success('Gán xe thành công');
    },
    onError: () => {
      toast.error('Không thể gán xe');
    },
  });
}
