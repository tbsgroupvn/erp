'use client';

/**
 * offline-provider.tsx
 * React context that exposes offline state to the entire app.
 * Wraps children, auto-syncs on reconnect, and provides the useOffline hook.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  useState,
} from 'react';
import {
  addSyncListener,
  getIsSyncing,
  isOnline,
  setupSyncListeners,
  startSync,
  type SyncEvent,
} from './sync-manager';
import { getPendingCount } from './mutation-queue';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
export interface OfflineContextValue {
  /** True when navigator.onLine === true. */
  isOnline: boolean;
  /** Number of mutations waiting to be synced. */
  pendingCount: number;
  /** True while the sync loop is running. */
  isSyncing: boolean;
  /** Manually trigger a sync attempt. */
  syncNow: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: () => undefined,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Keep a stable ref to avoid stale closure issues in event listeners.
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may be unavailable in SSR or private browsing.
    }
  }, []);

  // Sync the pending count on mount and whenever relevant sync events fire.
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Register sync-manager event listener.
  useEffect(() => {
    const removeSyncListener = addSyncListener(async (event: SyncEvent) => {
      switch (event.type) {
        case 'start':
          setSyncing(true);
          break;
        case 'progress':
          await refreshPendingCount();
          break;
        case 'completed':
        case 'idle':
          setSyncing(false);
          await refreshPendingCount();
          break;
        case 'failed':
          setSyncing(false);
          await refreshPendingCount();
          break;
      }
    });

    return removeSyncListener;
  }, [refreshPendingCount]);

  // Mirror navigator.onLine into React state.
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      refreshPendingCount();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Register the browser-level sync listeners (fires startSync on 'online').
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    cleanupRef.current = setupSyncListeners();
    return () => cleanupRef.current?.();
  }, []);

  // Initialise syncing state from the module singleton (handles hot-reload).
  useEffect(() => {
    setSyncing(getIsSyncing());
  }, []);

  const syncNow = useCallback(() => {
    startSync();
  }, []);

  return (
    <OfflineContext.Provider
      value={{ isOnline: online, pendingCount, isSyncing: syncing, syncNow }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}
