/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/erp',
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nhaphangchinhngach.vn',
      },
      {
        protocol: 'https',
        hostname: 'cdn.nhaphangchinhngach.vn',
      },
      // Add more specific domains as needed
      // Remove wildcard pattern for better security
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Enable SWC minification for better performance
  swcMinify: true,
  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

// Wrap config with bundle analyzer if ANALYZE env is set
let config = nextConfig;

if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
      enabled: true,
    });
    config = withBundleAnalyzer(nextConfig);
    console.log('✓ Bundle analyzer enabled');
  } catch (error) {
    console.warn('⚠️  @next/bundle-analyzer not installed. Run: npm install --save-dev @next/bundle-analyzer');
    console.warn('Building without bundle analysis...');
  }
}

export default config;
