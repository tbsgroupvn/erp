'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Public page error:', error);
    Sentry.captureException(error, {
      level: 'error',
      tags: { boundary: 'public' },
      extra: { path: window.location.pathname },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-lg text-center">
        {/* Error icon */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />
          </div>
        </div>

        {/* Main message */}
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Đã có lỗi xảy ra
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Chúng tôi đang khắc phục sự cố. Vui lòng thử lại sau.
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
            <summary className="cursor-pointer font-medium text-red-800">
              Chi tiết lỗi (Development only)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-red-700">
              {error.message}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Quay lại
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
