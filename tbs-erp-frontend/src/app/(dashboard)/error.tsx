'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
    const userRole = useAuthStore.getState().user?.role;
    Sentry.captureException(error, {
      level: 'error',
      tags: { boundary: 'dashboard', userRole: userRole || 'unknown' },
      extra: { path: window.location.pathname },
    });
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
        </div>

        <h2 className="mb-2 text-lg font-semibold text-red-900">
          Đã xảy ra lỗi
        </h2>

        <p className="mb-4 text-sm text-red-700">
          Rất tiếc, có lỗi xảy ra khi hiển thị nội dung này. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề tiếp diễn.
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4 rounded bg-red-100 p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-red-800">
              Chi tiết lỗi (chỉ hiện trong development)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-red-900">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>

          <a
            href="/tong-quan"
            className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Quay về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
