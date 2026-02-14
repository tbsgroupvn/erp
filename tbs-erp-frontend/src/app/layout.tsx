import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { ToastProvider } from '@/lib/providers/toast-provider';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'TBS ERP',
  description: 'Hệ thống quản lý doanh nghiệp TBS - Vận chuyển & Logistics Trung Quốc - Việt Nam',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://nhaphangchinhngach.vn" />
        <link rel="dns-prefetch" href="https://cdn.nhaphangchinhngach.vn" />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
        >
          Bỏ qua đến nội dung chính
        </a>
        <QueryProvider>
          <AuthProvider>
            {children}
            <ToastProvider />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
