'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onboardingApi } from '@/lib/api/onboarding.api';
import type { CreateChecklistDto, OnboardingQueryParams } from '@/lib/api/onboarding.api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const onboardingKeys = {
  all: ['onboarding'] as const,
  lists: () => [...onboardingKeys.all, 'list'] as const,
  list: (params?: OnboardingQueryParams) => [...onboardingKeys.lists(), params] as const,
  byEmployee: (employeeId: string) => [...onboardingKeys.all, 'employee', employeeId] as const,
  detail: (id: string) => [...onboardingKeys.all, 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOnboardingList(params?: OnboardingQueryParams) {
  return useQuery({
    queryKey: onboardingKeys.list(params),
    queryFn: () => onboardingApi.list(params),
  });
}

export function useOnboardingByEmployee(employeeId: string) {
  return useQuery({
    queryKey: onboardingKeys.byEmployee(employeeId),
    queryFn: () => onboardingApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useOnboardingDetail(id: string) {
  return useQuery({
    queryKey: onboardingKeys.detail(id),
    queryFn: () => onboardingApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChecklistDto) => onboardingApi.create(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: onboardingKeys.lists() });
      qc.invalidateQueries({ queryKey: onboardingKeys.byEmployee(variables.employeeId) });
      toast.success('Tạo checklist thành công');
    },
    onError: () => {
      toast.error('Không thể tạo checklist');
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIndex }: { id: string; itemIndex: number }) =>
      onboardingApi.toggleItem(id, itemIndex),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: onboardingKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: onboardingKeys.lists() });
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái mục');
    },
  });
}

export function useMarkChecklistComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => onboardingApi.markComplete(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: onboardingKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: onboardingKeys.lists() });
      toast.success('Checklist đã được đánh dấu hoàn thành');
    },
    onError: () => {
      toast.error('Không thể đánh dấu hoàn thành checklist');
    },
  });
}
