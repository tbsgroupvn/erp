'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  // State
  isOpen: boolean;
  isCollapsed: boolean;
  openGroups: string[];

  // Actions
  toggle: () => void;
  setOpen: (open: boolean) => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleGroup: (groupId: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      // Initial state
      isOpen: true,
      isCollapsed: false,
      openGroups: [],

      // Actions
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      setOpen: (open) => set({ isOpen: open }),

      toggleCollapsed: () =>
        set((state) => ({ isCollapsed: !state.isCollapsed })),

      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),

      toggleGroup: (groupId) =>
        set((state) => ({
          openGroups: state.openGroups.includes(groupId)
            ? state.openGroups.filter((id) => id !== groupId)
            : [...state.openGroups, groupId],
        })),
    }),
    {
      name: 'tbs-sidebar-storage',
    },
  ),
);
