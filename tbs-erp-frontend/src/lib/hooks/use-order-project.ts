'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orderProjectApi } from '@/lib/api/order-project.api';
import type { ReassignOrderDto } from '@/lib/types/order-project.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const orderProjectKeys = {
  all: ['order-project'] as const,
  views: () => [...orderProjectKeys.all, 'view'] as const,
  view: (orderId: string) => [...orderProjectKeys.views(), orderId] as const,
  assignments: (orderId: string) =>
    [...orderProjectKeys.all, 'assignments', orderId] as const,
  handoffs: (orderId: string) =>
    [...orderProjectKeys.all, 'handoffs', orderId] as const,
  myAssignments: () => [...orderProjectKeys.all, 'my-assignments'] as const,
  departmentBoard: () => [...orderProjectKeys.all, 'department-board'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOrderProject(orderId: string) {
  return useQuery({
    queryKey: orderProjectKeys.view(orderId),
    queryFn: () => orderProjectApi.getOrderProjectView(orderId),
    enabled: !!orderId,
  });
}

export function useOrderAssignments(orderId: string) {
  return useQuery({
    queryKey: orderProjectKeys.assignments(orderId),
    queryFn: () => orderProjectApi.getOrderAssignments(orderId),
    enabled: !!orderId,
  });
}

export function useOrderHandoffs(orderId: string) {
  return useQuery({
    queryKey: orderProjectKeys.handoffs(orderId),
    queryFn: () => orderProjectApi.getOrderHandoffs(orderId),
    enabled: !!orderId,
  });
}

export function useMyAssignments() {
  return useQuery({
    queryKey: orderProjectKeys.myAssignments(),
    queryFn: () => orderProjectApi.getMyAssignments(),
    refetchInterval: 60_000,
  });
}

export function useDepartmentBoard() {
  return useQuery({
    queryKey: orderProjectKeys.departmentBoard(),
    queryFn: () => orderProjectApi.getDepartmentBoard(),
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useReassignOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      orderId: string;
      assignmentId: string;
      data: ReassignOrderDto;
    }) => orderProjectApi.reassignOrder(params.orderId, params.assignmentId, params.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: orderProjectKeys.view(variables.orderId) });
      qc.invalidateQueries({ queryKey: orderProjectKeys.assignments(variables.orderId) });
      qc.invalidateQueries({ queryKey: orderProjectKeys.myAssignments() });
      qc.invalidateQueries({ queryKey: orderProjectKeys.departmentBoard() });
      toast.success('Phân công lại thành công');
    },
  });
}
