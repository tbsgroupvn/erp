'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsApi,
  type NotificationQueryParams,
} from '@/lib/api/notifications.api';
import { useNotificationStore } from '@/lib/stores/notification-store';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params?: NotificationQueryParams) => [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    staleTime: 30 * 1000,
  });
}

export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
      return count;
    },
    staleTime: 15 * 1000, // unread count — keep fresh
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useMarkAsRead() {
  const qc = useQueryClient();
  const markAsReadStore = useNotificationStore((s) => s.markAsRead);
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: (_data, id) => {
      markAsReadStore(id);
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
