'use client';

import { create } from 'zustand';
import type { Notification } from '@/lib/types';

interface NotificationState {
  // State
  unreadCount: number;
  recentItems: Notification[];

  // Actions
  setUnreadCount: (count: number) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  // Initial state
  unreadCount: 0,
  recentItems: [],

  // Actions
  setUnreadCount: (count) => set({ unreadCount: count }),

  addNotification: (notification) =>
    set((state) => ({
      recentItems: [notification, ...state.recentItems].slice(0, 50), // keep last 50
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    })),

  markAsRead: (id) =>
    set((state) => {
      const item = state.recentItems.find((n) => n.id === id);
      const wasUnread = item && !item.isRead;
      return {
        recentItems: state.recentItems.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: wasUnread
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    }),

  clearAll: () => set({ recentItems: [], unreadCount: 0 }),
}));
