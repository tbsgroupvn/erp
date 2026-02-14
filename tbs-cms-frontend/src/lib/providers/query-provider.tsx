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
            // Retry failed requests once
            retry: 1,
            // Don't refetch on window focus to reduce unnecessary requests
            refetchOnWindowFocus: false,
            // Don't refetch on mount if data is still fresh
            refetchOnMount: false,
            // Enable request deduplication
            structuralSharing: true,
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
