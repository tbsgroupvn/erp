import { withSentryConfig } from '@sentry/nextjs';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 365 },
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|avif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath removed: Nginx proxies each domain to root, no path prefix needed
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Skip TS and ESLint errors during build (non-blocking issues)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Increase static page generation timeout (default 60s)
  staticPageGenerationTimeout: 120,
  // Security headers
  async headers() {
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      // CSP is set dynamically via middleware.ts with per-request nonce
    ];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Redirects for consolidated menu items (absorbed as tabs into parent pages)
  async redirects() {
    return [
      { source: '/theo-doi', destination: '/container?tab=tracking', permanent: true },
      { source: '/tai-xe', destination: '/phuong-tien?tab=tai-xe', permanent: true },
      { source: '/tai-chinh/bu-tru-cong-no', destination: '/tai-chinh/cong-no-phai-thu?tab=bu-tru', permanent: true },
      { source: '/tai-chinh/chua-phan-bo', destination: '/tai-chinh/cong-no-phai-thu?tab=chua-phan-bo', permanent: true },
      { source: '/tai-chinh/ty-gia', destination: '/so-cai?tab=ty-gia', permanent: true },
      { source: '/tai-san', destination: '/so-cai?tab=tai-san', permanent: true },
      { source: '/ngan-sach', destination: '/so-cai?tab=ngan-sach', permanent: true },
      { source: '/nha-cung-cap', destination: '/mua-hang?tab=nha-cung-cap', permanent: true },
      { source: '/kho-vat-tu', destination: '/mua-hang?tab=kho-vat-tu', permanent: true },
      { source: '/nghi-phep', destination: '/cham-cong?tab=nghi-phep', permanent: true },
      { source: '/wiki', destination: '/tai-lieu?tab=wiki', permanent: true },
      { source: '/video', destination: '/ai-assistant?tab=video', permanent: true },
      { source: '/automation', destination: '/ai-assistant?tab=automation', permanent: true },
      { source: '/uy-quyen', destination: '/phe-duyet?tab=uy-quyen', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      // Production API / media server
      { protocol: 'https', hostname: 'api.nhaphangchinhngach.vn' },
      { protocol: 'https', hostname: '*.nhaphangchinhngach.vn' },
      // MinIO object storage (self-hosted CDN)
      { protocol: 'https', hostname: 'minio.tbslogistics.com' },
      { protocol: 'https', hostname: '*.tbslogistics.com' },
      // Local development
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'recharts'],
  },
};

// Wrap config with bundle analyzer if ANALYZE env is set
let config = withPWA(nextConfig);

if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
      enabled: true,
    });
    config = withBundleAnalyzer(config);
    console.log('Bundle analyzer enabled');
  } catch (error) {
    console.warn('@next/bundle-analyzer not installed. Run: npm install --save-dev @next/bundle-analyzer');
    console.warn('Building without bundle analysis...');
  }
}

// Wrap with Sentry error reporting
config = withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  hideSourceMaps: true,
  disableLogger: true,
});

export default config;
