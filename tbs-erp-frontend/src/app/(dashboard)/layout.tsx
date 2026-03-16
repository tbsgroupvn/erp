'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { DemoBanner } from '@/components/shared/demo-banner';
import { CommandPalette } from '@/features/search/command-palette';
import { OfflineProvider } from '@/lib/offline/offline-provider';
import { OfflineIndicator } from '@/components/shared/offline-indicator';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  // Initialize WebSocket connection for the entire dashboard session
  useWebSocket({ autoConnect: true });
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand to hydrate from localStorage
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated && !isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isLoading, isAuthenticated, router]);

  // Show loading while hydrating or validating session
  if (!hydrated || isLoading) {
    return <LoadingOverlay className="h-screen" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <OfflineProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Bỏ qua điều hướng
      </a>
      <div className="flex h-screen flex-col overflow-hidden">
        <DemoBanner />
        <CommandPalette />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <main
              id="main-content"
              role="main"
              aria-label="Nội dung chính"
              className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-background via-background to-muted/30"
              tabIndex={-1}
            >
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <OfflineIndicator />
      </div>
    </OfflineProvider>
  );
}
