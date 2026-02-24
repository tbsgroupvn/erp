'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 1 minute before considering it stale
            staleTime: 60_000, // 1 minute
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            // Don't retry on auth errors
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 3;
            },
            // Don't refetch on window focus to reduce unnecessary requests
            refetchOnWindowFocus: false,
            // Refetch on mount if data is stale (respects staleTime)
            refetchOnMount: true,
            // Enable request deduplication
            structuralSharing: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
          mutations: {
            // Never retry mutations to avoid duplicate side effects
            retry: false,
            onError: (error: unknown) => {
              // Generic error message, don't leak details
              const message = (error as { message?: string })?.message || 'Unknown error';
              console.error('Mutation error:', message);
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
