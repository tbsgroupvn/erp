'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Home, Package, Search, Phone, FileText } from 'lucide-react';

export default function NotFound() {
  const quickLinks = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/dich-vu', label: 'Dịch vụ', icon: Package },
    { href: '/tra-cuu', label: 'Tra cứu', icon: Search },
    { href: '/lien-he', label: 'Liên hệ', icon: Phone },
    { href: '/tin-tuc', label: 'Tin tức', icon: FileText },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-2xl animate-fade-in text-center">
        {/* 404 Number with gradient */}
        <div className="mb-8">
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-9xl font-extrabold text-transparent">
            404
          </h1>
        </div>

        {/* Main message */}
        <h2 className="mb-4 text-3xl font-bold text-gray-900">
          Trang không tồn tại
        </h2>
        <p className="mb-8 text-lg text-gray-600">
          Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
        </p>

        {/* Action buttons */}
        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            Về trang chủ
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Quay lại
          </button>
        </div>

        {/* Quick links grid */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <p className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Có thể bạn đang tìm kiếm:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <link.icon
                  className="h-5 w-5 text-gray-400 transition-colors group-hover:text-blue-600"
                  aria-hidden="true"
                />
                <span className="font-medium text-gray-700 transition-colors group-hover:text-blue-600">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
