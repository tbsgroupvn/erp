'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { automationApi } from '@/lib/api/automation.api';
import type {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@/lib/types/automation.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const automationKeys = {
  all: ['automation'] as const,
  lists: () => [...automationKeys.all, 'list'] as const,
  stats: () => [...automationKeys.all, 'stats'] as const,
  details: () => [...automationKeys.all, 'detail'] as const,
  detail: (id: string) => [...automationKeys.details(), id] as const,
  executions: (id: string) => [...automationKeys.all, 'executions', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAutomationRules() {
  return useQuery({
    queryKey: automationKeys.lists(),
    queryFn: () => automationApi.list(),
  });
}

export function useAutomationStats() {
  return useQuery({
    queryKey: automationKeys.stats(),
    queryFn: () => automationApi.getStats(),
  });
}

export function useAutomationRule(id: string) {
  return useQuery({
    queryKey: automationKeys.detail(id),
    queryFn: () => automationApi.getById(id),
    enabled: !!id,
  });
}

export function useAutomationExecutions(ruleId: string, limit = 50) {
  return useQuery({
    queryKey: automationKeys.executions(ruleId),
    queryFn: () => automationApi.getExecutions(ruleId, limit),
    enabled: !!ruleId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAutomationRuleDto) => automationApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.lists() });
      qc.invalidateQueries({ queryKey: automationKeys.stats() });
      toast.success('Tạo automation rule thành công');
    },
    onError: () => {
      toast.error('Không thể tạo automation rule');
    },
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAutomationRuleDto }) =>
      automationApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: automationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: automationKeys.lists() });
      qc.invalidateQueries({ queryKey: automationKeys.stats() });
      toast.success('Cập nhật automation rule thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật automation rule');
    },
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.lists() });
      qc.invalidateQueries({ queryKey: automationKeys.stats() });
      toast.success('Đã xóa automation rule');
    },
    onError: () => {
      toast.error('Không thể xóa automation rule');
    },
  });
}

export function useTestAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.test(id),
    onSuccess: (result, id) => {
      qc.invalidateQueries({ queryKey: automationKeys.detail(id) });
      qc.invalidateQueries({ queryKey: automationKeys.executions(id) });
      qc.invalidateQueries({ queryKey: automationKeys.lists() });
      if (result?.status === 'SUCCESS') {
        toast.success(`Test thành công (${result.durationMs}ms)`);
      } else {
        toast.error(`Test thất bại: ${result?.errorMsg ?? 'Unknown error'}`);
      }
    },
    onError: () => {
      toast.error('Không thể chạy test automation');
    },
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      automationApi.update(id, { status: active ? 'ACTIVE' : 'INACTIVE' }),
    onSuccess: (_data, { active }) => {
      qc.invalidateQueries({ queryKey: automationKeys.lists() });
      qc.invalidateQueries({ queryKey: automationKeys.stats() });
      toast.success(active ? 'Rule đã được bật' : 'Rule đã được tắt');
    },
    onError: () => {
      toast.error('Không thể thay đổi trạng thái rule');
    },
  });
}
