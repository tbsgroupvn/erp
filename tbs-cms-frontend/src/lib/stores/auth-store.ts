'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/lib/types';

interface AuthState {
  // State
  user: UserProfile | null;
  accessToken: string | null;
  // Note: refreshToken is now stored in HttpOnly cookie, not in state
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setTokens: (accessToken: string) => void;
  setUser: (user: UserProfile) => void;
  setAuth: (user: UserProfile, accessToken: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      setTokens: (accessToken) => {
        // Set cookie for Next.js middleware (only for auth flag, not the actual token)
        if (typeof document !== 'undefined') {
          document.cookie = `tbs-auth=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        set({ accessToken, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      setAuth: (user, accessToken) => {
        if (typeof document !== 'undefined') {
          document.cookie = `tbs-auth=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        set({ user, accessToken, isAuthenticated: true, isLoading: false });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      logout: () => {
        // Remove auth cookie
        if (typeof document !== 'undefined') {
          document.cookie = 'tbs-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      getAccessToken: () => get().accessToken,
    }),
    {
      name: 'tbs-auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        // Note: refreshToken is NOT persisted - it's in HttpOnly cookie on backend
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
        }
      },
    },
  ),
);
