'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/lib/types';
import { branding } from '@/lib/config/branding';

const AUTH_COOKIE = branding.authCookie;
const AUTH_STORAGE_NAME = branding.authStorageName;

interface TwoFactorChallenge {
  userId: string;
  methods: string[];
  tempToken: string;
}

interface AuthState {
  // State
  user: UserProfile | null;
  accessToken: string | null;
  // Note: refreshToken is stored in HttpOnly cookie by the backend, not in client state
  isAuthenticated: boolean;
  isLoading: boolean;

  // 2FA challenge state (transient, not persisted)
  twoFactorPending: boolean;
  twoFactorUserId: string | null;
  twoFactorMethods: string[];
  twoFactorTempToken: string | null;

  // Actions
  setTokens: (accessToken: string) => void;
  setUser: (user: UserProfile) => void;
  setAuth: (user: UserProfile, accessToken: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  getAccessToken: () => string | null;
  setTwoFactorChallenge: (challenge: TwoFactorChallenge) => void;
  clearTwoFactorChallenge: () => void;
  completeTwoFactorLogin: (user: UserProfile, accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state — unauthenticated (real login required)
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      // 2FA challenge state
      twoFactorPending: false,
      twoFactorUserId: null,
      twoFactorMethods: [],
      twoFactorTempToken: null,

      // Actions
      setTokens: (accessToken) => {
        // Set cookie for Next.js middleware (only for auth flag, not the actual token)
        if (typeof document !== 'undefined') {
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
        }
        set({ accessToken, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      setAuth: (user, accessToken) => {
        if (typeof document !== 'undefined') {
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
        }
        set({ user, accessToken, isAuthenticated: true, isLoading: false });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      logout: () => {
        // Remove auth cookie
        if (typeof document !== 'undefined') {
          document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      getAccessToken: () => {
        const token = get().accessToken;
        if (!token) return null;
        // Validate JWT token format and expiry
        try {
          const parts = token.split('.');
          if (parts.length !== 3) return null;
          const payload = JSON.parse(atob(parts[1]));
          // Check if token has expired (with 30 second buffer)
          if (payload.exp && payload.exp * 1000 < Date.now() - 30000) {
            return null;
          }
          return token;
        } catch {
          return null;
        }
      },

      setTwoFactorChallenge: (challenge) =>
        set({
          twoFactorPending: true,
          twoFactorUserId: challenge.userId,
          twoFactorMethods: challenge.methods,
          twoFactorTempToken: challenge.tempToken,
        }),

      clearTwoFactorChallenge: () =>
        set({
          twoFactorPending: false,
          twoFactorUserId: null,
          twoFactorMethods: [],
          twoFactorTempToken: null,
        }),

      completeTwoFactorLogin: (user, accessToken) => {
        if (typeof document !== 'undefined') {
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
        }
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
          twoFactorPending: false,
          twoFactorUserId: null,
          twoFactorMethods: [],
          twoFactorTempToken: null,
        });
      },
    }),
    {
      name: AUTH_STORAGE_NAME,
      partialize: (state) => ({
        user: state.user,
        // accessToken is NOT persisted to localStorage to prevent XSS token theft
        // It will be refreshed via HttpOnly cookie on page reload
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = true;
        }
      },
    },
  ),
);
