'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { okrApi } from '@/lib/api/okr.api';
import type {
  OKRQueryParams,
  OKRPeriod,
  OKRLevel,
  CreateObjectiveDto,
  UpdateObjectiveDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
  CheckInDto,
} from '@/lib/types/okr.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const okrKeys = {
  all: ['okr'] as const,
  objectives: () => [...okrKeys.all, 'objectives'] as const,
  objectivesList: (params?: OKRQueryParams) => [...okrKeys.objectives(), 'list', params] as const,
  objectiveDetail: (id: string) => [...okrKeys.objectives(), 'detail', id] as const,
  myOKRs: (period?: OKRPeriod, year?: number) =>
    [...okrKeys.all, 'my', { period, year }] as const,
  tree: (period?: OKRPeriod, year?: number) =>
    [...okrKeys.all, 'tree', { period, year }] as const,
  dashboard: () => [...okrKeys.all, 'dashboard'] as const,
  parentCandidates: (level: OKRLevel, period?: OKRPeriod, year?: number) =>
    [...okrKeys.all, 'parents', { level, period, year }] as const,
};

// ---------------------------------------------------------------------------
// Objective Queries
// ---------------------------------------------------------------------------

export function useObjectives(params?: OKRQueryParams) {
  return useQuery({
    queryKey: okrKeys.objectivesList(params),
    queryFn: () => okrApi.listObjectives(params),
  });
}

export function useObjective(id: string) {
  return useQuery({
    queryKey: okrKeys.objectiveDetail(id),
    queryFn: () => okrApi.getObjectiveById(id),
    enabled: !!id,
  });
}

export function useMyOKRs(period?: OKRPeriod, year?: number) {
  return useQuery({
    queryKey: okrKeys.myOKRs(period, year),
    queryFn: () => okrApi.getMyOKRs(period, year),
  });
}

export function useOKRTree(period?: OKRPeriod, year?: number) {
  return useQuery({
    queryKey: okrKeys.tree(period, year),
    queryFn: () => okrApi.getTree(period, year),
  });
}

export function useOKRDashboard() {
  return useQuery({
    queryKey: okrKeys.dashboard(),
    queryFn: () => okrApi.getDashboard(),
  });
}

export function useParentCandidates(level: OKRLevel, period?: OKRPeriod, year?: number) {
  return useQuery({
    queryKey: okrKeys.parentCandidates(level, period, year),
    queryFn: () => okrApi.getParentCandidates(level, period, year),
    enabled: !!level,
  });
}

// ---------------------------------------------------------------------------
// Objective Mutations
// ---------------------------------------------------------------------------

export function useCreateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateObjectiveDto) => okrApi.createObjective(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      qc.invalidateQueries({ queryKey: okrKeys.tree() });
      qc.invalidateQueries({ queryKey: okrKeys.dashboard() });
      toast.success('Da tao muc tieu thanh cong');
    },
    onError: () => {
      toast.error('Khong the tao muc tieu');
    },
  });
}

export function useUpdateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateObjectiveDto }) =>
      okrApi.updateObjective(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: okrKeys.objectiveDetail(id) });
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      qc.invalidateQueries({ queryKey: okrKeys.dashboard() });
      toast.success('Da cap nhat muc tieu');
    },
    onError: () => {
      toast.error('Khong the cap nhat muc tieu');
    },
  });
}

export function useDeleteObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => okrApi.deleteObjective(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      qc.invalidateQueries({ queryKey: okrKeys.tree() });
      qc.invalidateQueries({ queryKey: okrKeys.dashboard() });
      toast.success('Da xoa muc tieu');
    },
    onError: () => {
      toast.error('Khong the xoa muc tieu');
    },
  });
}

// ---------------------------------------------------------------------------
// Key Result Mutations
// ---------------------------------------------------------------------------

export function useCreateKeyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ objectiveId, dto }: { objectiveId: string; dto: CreateKeyResultDto }) =>
      okrApi.createKeyResult(objectiveId, dto),
    onSuccess: (_data, { objectiveId }) => {
      qc.invalidateQueries({ queryKey: okrKeys.objectiveDetail(objectiveId) });
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      toast.success('Da them ket qua then chot');
    },
    onError: () => {
      toast.error('Khong the them Key Result');
    },
  });
}

export function useUpdateKeyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keyResultId, dto }: { keyResultId: string; dto: UpdateKeyResultDto }) =>
      okrApi.updateKeyResult(keyResultId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      toast.success('Da cap nhat Key Result');
    },
    onError: () => {
      toast.error('Khong the cap nhat Key Result');
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keyResultId, dto }: { keyResultId: string; dto: CheckInDto }) =>
      okrApi.checkIn(keyResultId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      qc.invalidateQueries({ queryKey: okrKeys.myOKRs() });
      qc.invalidateQueries({ queryKey: okrKeys.dashboard() });
      toast.success('Da cap nhat tien do');
    },
    onError: () => {
      toast.error('Khong the cap nhat tien do');
    },
  });
}

export function useLinkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keyResultId, taskId }: { keyResultId: string; taskId: string }) =>
      okrApi.linkTask(keyResultId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      toast.success('Da lien ket task');
    },
    onError: () => {
      toast.error('Khong the lien ket task');
    },
  });
}

export function useUnlinkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keyResultId, taskId }: { keyResultId: string; taskId: string }) =>
      okrApi.unlinkTask(keyResultId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: okrKeys.objectives() });
      toast.success('Da huy lien ket task');
    },
    onError: () => {
      toast.error('Khong the huy lien ket');
    },
  });
}
