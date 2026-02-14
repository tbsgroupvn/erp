'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 px-4">
      <div className="w-full max-w-2xl animate-fade-in text-center">
        {/* Error icon with pulse animation */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20"></div>
            <AlertTriangle className="relative h-20 w-20 text-destructive" aria-hidden="true" />
          </div>
        </div>

        {/* Main message */}
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          Đã có lỗi xảy ra
        </h1>
        <p className="mb-2 text-lg text-gray-600">
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
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-destructive/90 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>

        {/* Help section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Cần hỗ trợ?
          </h3>
          <p className="mb-6 text-gray-600">
            Nếu lỗi vẫn tiếp tục xảy ra, vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/lien-he"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Liên hệ hỗ trợ
            </Link>
            <a
              href={`mailto:support@nhaphangchinhngach.vn?subject=Báo lỗi&body=Mô tả lỗi: ${encodeURIComponent(error.message)}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Gửi email báo lỗi
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
