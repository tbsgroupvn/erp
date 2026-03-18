'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { videoApi } from '@/lib/api/video.api';
import type { CreateRoomPayload } from '@/lib/types/video.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const videoKeys = {
  all: ['video'] as const,
  myRooms: () => [...videoKeys.all, 'my-rooms'] as const,
  room: (id: string) => [...videoKeys.all, 'room', id] as const,
  token: (id: string) => [...videoKeys.all, 'token', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Danh sách phòng họp ACTIVE/SCHEDULED của user hiện tại
 */
export function useMyRooms() {
  return useQuery({
    queryKey: videoKeys.myRooms(),
    queryFn: () => videoApi.getMyRooms(),
    staleTime: 30_000,
  });
}

/**
 * Chi tiết một phòng họp
 */
export function useVideoRoom(id: string) {
  return useQuery({
    queryKey: videoKeys.room(id),
    queryFn: () => videoApi.getRoom(id),
    enabled: !!id,
  });
}

/**
 * Lấy token tham gia phòng họp
 */
export function useRoomToken(id: string, enabled = true) {
  return useQuery({
    queryKey: videoKeys.token(id),
    queryFn: () => videoApi.getRoomToken(id),
    enabled: !!id && enabled,
    staleTime: 50 * 60 * 1000, // token valid 1h, refetch sau 50p
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Tạo phòng họp mới
 */
export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoomPayload) => videoApi.createRoom(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: videoKeys.myRooms() });
      toast.success('Phòng họp đã được tạo');
    },
  });
}

/**
 * Kết thúc phòng họp (host only)
 */
export function useEndRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => videoApi.endRoom(roomId),
    onSuccess: (_data, roomId) => {
      qc.invalidateQueries({ queryKey: videoKeys.myRooms() });
      qc.invalidateQueries({ queryKey: videoKeys.room(roomId) });
      toast.success('Phòng họp đã kết thúc');
    },
  });
}

/**
 * Bắt đầu video call nhanh từ chat conversation
 */
export function useStartDMCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => videoApi.startDMCall(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: videoKeys.myRooms() });
    },
  });
}

/**
 * Lấy token rồi join ngay (mutation để fetch on-demand)
 */
export function useGetRoomToken() {
  return useMutation({
    mutationFn: (roomId: string) => videoApi.getRoomToken(roomId),
  });
}
