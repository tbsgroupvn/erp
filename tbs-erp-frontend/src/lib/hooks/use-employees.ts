'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { employeesApi } from '@/lib/api/employees.api';
import type { EmployeeQueryParams, CreateEmployeeDto, UpdateEmployeeDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params?: EmployeeQueryParams) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useEmployees(params?: EmployeeQueryParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => employeesApi.list(params as Record<string, unknown>),
    staleTime: 2 * 60 * 1000, // employee lists — 2 min
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeesApi.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeDto) => employeesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      toast.success('Tạo nhân viên thành công');
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeDto }) =>
      employeesApi.update(id, data as unknown as Record<string, unknown>),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      toast.success('Cập nhật nhân viên thành công');
    },
  });
}
