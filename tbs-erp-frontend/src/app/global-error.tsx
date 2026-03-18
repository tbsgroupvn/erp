'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const userRole = useAuthStore.getState().user?.role;
    Sentry.captureException(error, {
      level: 'fatal',
      tags: { boundary: 'global', userRole: userRole || 'unknown' },
      extra: { path: window.location.href },
    });
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-lg text-center">
            {/* Error icon */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20"></div>
                <AlertTriangle className="relative h-20 w-20 text-red-600" aria-hidden="true" />
              </div>
            </div>

            {/* Main message */}
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Hệ thống gặp sự cố
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Chúng tôi đang khắc phục. Vui lòng tải lại trang.
            </p>

            {/* Error details in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                <summary className="cursor-pointer font-medium text-red-800">
                  Chi tiết lỗi (Development only)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-700">
                  {error.message}
                  {error.digest && `\nDigest: ${error.digest}`}
                </pre>
              </details>
            )}

            {/* Reload button */}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
