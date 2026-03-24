'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth.api';
import type { UserProfile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Refresh lock to prevent concurrent token refreshes
// ---------------------------------------------------------------------------
let isRefreshing = false;
let refreshPromise: Promise<{ accessToken: string }> | null = null;

async function refreshTokenWithLock(): Promise<{ accessToken: string }> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = authApi.refreshToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Validate session on mount ----
  const validateSession = useCallback(async () => {
    const { accessToken, isAuthenticated: isAuth, setUser, setLoading, logout } =
      useAuthStore.getState();

    // Not authenticated at all — nothing to validate
    if (!isAuth && !accessToken) {
      setLoading(false);
      return;
    }

    // If we have an access token, try using it directly
    if (accessToken) {
      try {
        const profile = await authApi.getProfile();
        setUser(profile);
        setLoading(false);
        return;
      } catch {
        // Token expired or invalid — fall through to refresh
      }
    }

    // Access token missing or expired — try refresh via HttpOnly cookie
    try {
      const tokens = await refreshTokenWithLock();
      useAuthStore.getState().setTokens(tokens.accessToken);
      const profile = await authApi.getProfile();
      setUser(profile);
      setLoading(false);
    } catch {
      // Refresh also failed — session is dead
      logout();
    }
  }, []);

  // ---- Schedule token refresh before expiry ----
  const scheduleRefresh = useCallback(() => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const { isAuthenticated: isAuth } = useAuthStore.getState();
    if (!isAuth) return;

    // Refresh 60 seconds before expiry. Since we don't store exact expiry,
    // use a conservative 14-minute interval (assuming 15-min token lifetime).
    const REFRESH_INTERVAL = 14 * 60 * 1000;

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const tokens = await refreshTokenWithLock();
        useAuthStore.getState().setTokens(tokens.accessToken);
        // Re-schedule after successful refresh
        scheduleRefresh();
      } catch {
        // If refresh fails, the interceptor will handle logout on next 401
      }
    }, REFRESH_INTERVAL);
  }, []);

  useEffect(() => {
    validateSession().then(() => {
      scheduleRefresh();
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [validateSession, scheduleRefresh]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
