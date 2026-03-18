'use client';

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/utils/parse-api-error';
import { getErrorMessage } from '@/lib/utils/error-messages';

// ---------------------------------------------------------------------------
// Sync TanStack Query's online state with the browser
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  onlineManager.setEventListener((setOnline) => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    // Set initial state
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  });
}

// ---------------------------------------------------------------------------
// Lightweight query cache persistence via localStorage
// ---------------------------------------------------------------------------
const CACHE_KEY = 'tbs-query-cache';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function persistQueryCache(client: QueryClient): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = client.getQueryCache().getAll();
    const serialisable = cache
      .filter((query) => query.state.status === 'success' && query.state.data != null)
      .map((query) => ({
        queryKey: query.queryKey,
        data: query.state.data,
        dataUpdatedAt: query.state.dataUpdatedAt,
      }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(serialisable));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

function restoreQueryCache(client: QueryClient): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Array<{
      queryKey: unknown[];
      data: unknown;
      dataUpdatedAt: number;
    }>;
    const now = Date.now();
    for (const entry of entries) {
      // Skip entries that are too old
      if (now - entry.dataUpdatedAt > CACHE_MAX_AGE) continue;
      client.setQueryData(entry.queryKey, entry.data, {
        updatedAt: entry.dataUpdatedAt,
      });
    }
  } catch {
    // Corrupted data — clear and continue
    localStorage.removeItem(CACHE_KEY);
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Global default: 30 seconds before considering data stale
            staleTime: 30 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Don't retry on auth errors; reduce default retries to 1
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 1;
            },
            // Don't refetch on window focus to reduce unnecessary requests
            refetchOnWindowFocus: false,
            // Refetch on mount if data is stale (respects staleTime)
            refetchOnMount: true,
            // Enable request deduplication
            structuralSharing: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
            // Serve cached data while offline instead of failing immediately
            networkMode: 'offlineFirst',
          },
          mutations: {
            // Never retry mutations to avoid duplicate side effects
            retry: false,
            // Allow mutations to fire even when offline (the Axios interceptor queues them)
            networkMode: 'offlineFirst',
            onError: (error: unknown) => {
              const parsed = parseApiError(error);
              const message = getErrorMessage(parsed.errorCode);

              toast.error(message, {
                description: parsed.requestId
                  ? `M\u00e3 l\u1ed7i: ${parsed.requestId}`
                  : undefined,
              });
            },
          },
        },
      }),
  );

  // Restore cache on mount, persist on unload and periodically
  useEffect(() => {
    restoreQueryCache(queryClient);

    // Persist cache before page unload so data survives refresh while offline
    const handleBeforeUnload = () => persistQueryCache(queryClient);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also persist periodically (every 30s) in case the page crashes
    const intervalId = setInterval(() => persistQueryCache(queryClient), 30_000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
      // Final persist on cleanup
      persistQueryCache(queryClient);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
