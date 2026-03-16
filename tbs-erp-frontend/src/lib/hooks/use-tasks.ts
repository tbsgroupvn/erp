'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi } from '@/lib/api/tasks.api';
import type { TaskQueryParams, CreateTaskDto, UpdateTaskDto, Task } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params?: TaskQueryParams) => [...taskKeys.lists(), params] as const,
  myTasks: () => [...taskKeys.all, 'my'] as const,
  myList: (params?: TaskQueryParams) => [...taskKeys.myTasks(), params] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  overdue: () => [...taskKeys.all, 'overdue'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksApi.list(params as Record<string, unknown>),
  });
}

export function useMyTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: taskKeys.myList(params),
    queryFn: () => tasksApi.getMyTasks(params as Record<string, unknown>),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  });
}

export function useOverdueTasks() {
  return useQuery({
    queryKey: taskKeys.overdue(),
    queryFn: () => tasksApi.getOverdue(),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskDto) => tasksApi.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.myTasks() });
      toast.success('Tạo công việc thành công');
    },
    onError: () => {
      toast.error('Không thể tạo công việc');
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskDto }) =>
      tasksApi.update(id, data as unknown as Record<string, unknown>),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.myTasks() });
      toast.success('Cập nhật công việc thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật công việc');
    },
  });
}

export function useChangeTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.changeStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.myTasks() });
      toast.success('Cập nhật trạng thái thành công');
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      tasksApi.addComment(id, content),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
      toast.success('Thêm bình luận thành công');
    },
    onError: () => {
      toast.error('Không thể thêm bình luận');
    },
  });
}

// ---------------------------------------------------------------------------
// Optimistic status update (for Kanban drag & drop)
// ---------------------------------------------------------------------------

export function useOptimisticTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.changeStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel any in-flight queries
      await qc.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot all list queries
      const previousData = qc.getQueriesData<{ data: Task[] }>({ queryKey: taskKeys.lists() });

      // Optimistically update every cached list
      qc.setQueriesData<{ data: Task[]; meta?: unknown }>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((t) =>
              t.id === id ? { ...t, status: status as Task['status'] } : t,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, value]) => {
          qc.setQueryData(key, value);
        });
      }
      toast.error('Không thể cập nhật trạng thái');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.myTasks() });
    },
  });
}
