'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api/client';
import type { AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Total idle timeout in ms (default: 30 minutes). Override via NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES. */
const IDLE_TIMEOUT_MS =
  (Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES) || 30) * 60 * 1000;

/** Show the warning dialog this many ms before the timeout fires. */
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes

/** Throttle interval for DOM activity events (ms). */
const THROTTLE_MS = 30_000; // 30 seconds — no need to reset more often

/** Events that indicate user is active in the browser tab. */
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseIdleTimeoutReturn {
  /** Whether the warning dialog should be shown. */
  showWarning: boolean;
  /** Seconds remaining before auto-logout (only meaningful when showWarning is true). */
  secondsLeft: number;
  /** Call this to dismiss the warning and reset the idle timer. */
  stayLoggedIn: () => void;
}

export function useIdleTimeout(): UseIdleTimeoutReturn {
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(WARNING_BEFORE_MS / 1000),
  );

  // Refs to hold timer IDs so we can clear them on reset / unmount.
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const showWarningRef = useRef(showWarning);
  showWarningRef.current = showWarning;

  // ------- helpers -------

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    lastActivityRef.current = Date.now();

    // Timer 1: show warning dialog (IDLE_TIMEOUT - WARNING_BEFORE) ms from now
    const warningDelay = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS;
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));

      // Start a 1-second countdown for the dialog
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // countdown done — clearInterval will happen via logoutTimer cleanup
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningDelay);

    // Timer 2: auto-logout at the full timeout
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearAllTimers, logout]);

  // ------- public action -------

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    startTimers();
  }, [startTimers]);

  // ------- reset on user activity (throttled) -------

  const resetActivity = useCallback(() => {
    // Don't reset while the warning dialog is visible — user must explicitly click "Stay logged in"
    if (showWarningRef.current) return;

    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;

    startTimers();
  }, [startTimers]);

  // ------- DOM event listeners -------

  useEffect(() => {
    if (!isAuthenticated) return;

    // Attach throttled DOM activity listeners
    const handler = () => resetActivity();

    for (const evt of ACTIVITY_EVENTS) {
      document.addEventListener(evt, handler, { passive: true });
    }

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, handler);
      }
    };
  }, [isAuthenticated, resetActivity]);

  // ------- Axios interceptor: treat API calls as activity -------

  useEffect(() => {
    if (!isAuthenticated) return;

    const interceptorId = apiClient.interceptors.response.use(
      (response: AxiosResponse) => {
        resetActivity();
        return response;
      },
      (error) => {
        // Even failed requests (except 401) count as activity
        if (error?.response?.status !== 401) {
          resetActivity();
        }
        return Promise.reject(error);
      },
    );

    return () => {
      apiClient.interceptors.response.eject(interceptorId);
    };
  }, [isAuthenticated, resetActivity]);

  // ------- bootstrap timers on mount -------

  useEffect(() => {
    if (!isAuthenticated) return;

    startTimers();

    return () => {
      clearAllTimers();
    };
  }, [isAuthenticated, startTimers, clearAllTimers]);

  return { showWarning, secondsLeft, stayLoggedIn };
}
