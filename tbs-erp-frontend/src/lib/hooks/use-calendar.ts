'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarApi } from '@/lib/api/calendar.api';
import type { CreateEventPayload, UpdateEventPayload } from '@/lib/types/calendar.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const calendarKeys = {
  all: ['calendar'] as const,
  events: (params?: { from?: string; to?: string }) =>
    [...calendarKeys.all, 'events', params] as const,
  event: (id: string) => [...calendarKeys.all, 'event', id] as const,
  rooms: () => [...calendarKeys.all, 'rooms'] as const,
  freeBusy: (userId: string, from: string, to: string) =>
    [...calendarKeys.all, 'free-busy', userId, from, to] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCalendarEvents(from?: string, to?: string) {
  return useQuery({
    queryKey: calendarKeys.events({ from, to }),
    queryFn: () => calendarApi.getEvents({ from, to }),
    staleTime: 30_000,
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: calendarKeys.event(id),
    queryFn: () => calendarApi.getEventById(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMeetingRooms() {
  return useQuery({
    queryKey: calendarKeys.rooms(),
    queryFn: calendarApi.getRooms,
    staleTime: 5 * 60_000,
  });
}

export function useFreeBusy(userId: string, from: string, to: string) {
  return useQuery({
    queryKey: calendarKeys.freeBusy(userId, from, to),
    queryFn: () => calendarApi.getFreeBusy(userId, from, to),
    enabled: !!userId && !!from && !!to,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventPayload) => calendarApi.createEvent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success('Tao su kien thanh cong');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Khong the tao su kien';
      toast.error(msg);
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventPayload }) =>
      calendarApi.updateEvent(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      qc.invalidateQueries({ queryKey: calendarKeys.event(id) });
      toast.success('Cap nhat su kien thanh cong');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Khong the cap nhat su kien';
      toast.error(msg);
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success('Da xoa su kien');
    },
    onError: () => toast.error('Khong the xoa su kien'),
  });
}

export function useRespondToEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
    }) => calendarApi.respondToEvent(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      qc.invalidateQueries({ queryKey: calendarKeys.event(id) });
      toast.success('Da cap nhat trang thai tham gia');
    },
    onError: () => toast.error('Khong the cap nhat trang thai'),
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: calendarApi.createRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.rooms() });
      toast.success('Tao phong hop thanh cong');
    },
    onError: () => toast.error('Khong the tao phong hop'),
  });
}
