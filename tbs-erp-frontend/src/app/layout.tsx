import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { ToastProvider } from '@/lib/providers/toast-provider';
import { ThemeProvider } from '@/lib/providers/theme-provider';
import { AriaLiveRegion } from '@/lib/utils/a11y';
import { A11yDevTools } from '@/lib/utils/a11y-dev';

// next/font/google self-hosts fonts at BUILD TIME — no runtime requests to Google
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System';
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Enterprise Resource Planning System';

export const metadata: Metadata = {
  title: appTitle,
  description: appDescription,
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e40af' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appTitle,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* PWA meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TBS Workplace" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${poppins.variable} ${inter.className}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Bo qua den noi dung chinh
        </a>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <ToastProvider />
              <AriaLiveRegion />
              <A11yDevTools />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
