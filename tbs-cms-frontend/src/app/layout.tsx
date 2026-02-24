import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { ToastProvider } from '@/lib/providers/toast-provider';
import { ThemeProvider } from '@/lib/providers/theme-provider';
import { I18nProvider } from '@/lib/providers/i18n-provider';
import { AriaLiveRegion } from '@/lib/utils/a11y';
import { A11yDevTools } from '@/lib/utils/a11y-dev';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE || 'CMS System',
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Content Management System',
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e40af' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: process.env.NEXT_PUBLIC_APP_TITLE || 'CMS System',
  },
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
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Bo qua den noi dung chinh
        </a>
        <ThemeProvider>
          <I18nProvider>
            <QueryProvider>
              <AuthProvider>
                {children}
                <ToastProvider />
                <AriaLiveRegion />
                <A11yDevTools />
              </AuthProvider>
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
