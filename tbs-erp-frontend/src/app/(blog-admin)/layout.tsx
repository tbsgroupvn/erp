'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Home } from 'lucide-react';

export default function BlogAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
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
    <div className="min-h-screen bg-slate-50">
      {/* Simple Admin Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/tong-quan"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                href="/bai-viet"
                className="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <FileText className="h-4 w-4" />
                Quản lý Blog
              </Link>
            </div>
            <Link href="/tin-tuc" target="_blank">
              <Button variant="outline" size="sm">
                Xem trang blog
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
