# Performance Optimizations Guide

This document outlines all the performance optimizations implemented in the TBS ERP Frontend application to achieve a 10/10 Lighthouse score.

## Table of Contents

1. [Code Splitting](#code-splitting)
2. [Resource Hints](#resource-hints)
3. [Font Optimization](#font-optimization)
4. [Service Worker & Caching](#service-worker--caching)
5. [Request Deduplication](#request-deduplication)
6. [Performance Monitoring](#performance-monitoring)
7. [Bundle Analysis](#bundle-analysis)
8. [Image Optimizations](#image-optimizations)
9. [Next.js Optimizations](#nextjs-optimizations)
10. [Testing Performance](#testing-performance)

---

## Code Splitting

### Dynamic Imports

Heavy components are loaded on-demand using Next.js dynamic imports:

**Homepage:**
```typescript
// src/app/(public)/page.tsx
const Testimonials = dynamic(
  () => import('./components/testimonials').then(mod => ({ default: mod.Testimonials })),
  {
    loading: () => <TestimonialsSkeleton />,
    ssr: true,
  }
);
```

**Pricing Calculator:**
```typescript
// src/app/(public)/tinh-phi/page.tsx
const PricingCalculator = dynamic(
  () => import('../components/pricing-calculator'),
  {
    loading: () => <PricingCalculatorSkeleton />,
    ssr: false,
  }
);
```

**Rich Text Editor:**
```typescript
// src/components/blog/rich-text-editor.tsx
const QuillEditor = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
```

### Benefits
- Reduces initial bundle size
- Improves Time to Interactive (TTI)
- Better First Contentful Paint (FCP)
- Loads non-critical components only when needed

---

## Resource Hints

### Preconnect & DNS Prefetch

Added to `src/app/layout.tsx`:

```tsx
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link rel="dns-prefetch" href="https://nhaphangchinhngach.vn" />
  <link rel="dns-prefetch" href="https://cdn.nhaphangchinhngach.vn" />
</head>
```

### Benefits
- Reduces DNS lookup time
- Establishes early connections to critical origins
- Improves resource loading speed

---

## Font Optimization

### Google Fonts with font-display: swap

```typescript
// src/app/layout.tsx
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',        // Prevent FOIT (Flash of Invisible Text)
  preload: true,          // Preload font files
  variable: '--font-inter', // CSS variable for easy access
});
```

### Benefits
- Eliminates layout shift from font loading
- Improves Cumulative Layout Shift (CLS)
- Shows fallback font immediately
- Preloads critical font files

---

## Service Worker & Caching

### Implementation

Service Worker: `public/sw.js`

#### Caching Strategies:

1. **Static Assets (JS, CSS, Fonts)**: Cache First
   - Try cache first, fall back to network
   - Cache for 30 days

2. **Images**: Cache First
   - Try cache first, fall back to network
   - Cache for 7 days

3. **API Requests**: Network First
   - Try network first, fall back to cache
   - Cache for 5 minutes

4. **HTML Pages**: Network First
   - Try network first, fall back to cache
   - Shows offline page when offline

### Features
- Offline support with fallback page
- Background sync for offline actions
- Push notification support
- Automatic cache cleanup

### Usage

To register the service worker, add to your app:

```typescript
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## Request Deduplication

### React Query Configuration

Optimized settings in `src/lib/providers/query-provider.tsx`:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,              // 1 minute
      gcTime: 10 * 60 * 1000,         // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      structuralSharing: true,        // Enable deduplication
      refetchOnReconnect: true,
    },
  },
});
```

### Benefits
- Prevents duplicate API calls
- Reduces server load
- Improves response times
- Better cache utilization

---

## Performance Monitoring

### Web Vitals Tracking

Utility: `src/lib/utils/performance.ts`

```typescript
import { reportWebVitals } from '@/lib/utils/performance';

// In your root layout or _app
export function reportWebVitals(metric: Metric) {
  // Automatically logs in dev, sends to analytics in prod
}
```

### Tracked Metrics

- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **TTFB** (Time to First Byte)
- **INP** (Interaction to Next Paint)

### Custom Performance Marks

```typescript
import { markPerformance, measurePerformance } from '@/lib/utils/performance';

// Mark start
markPerformance('data-fetch-start');

// Do work...

// Mark end and measure
measurePerformance('data-fetch', 'data-fetch-start');
```

---

## Bundle Analysis

### Setup

1. Install analyzer:
```bash
npm install --save-dev @next/bundle-analyzer
```

2. Analyze bundle:
```bash
ANALYZE=true npm run build
```

### Configuration

Already configured in `next.config.mjs`:

```javascript
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
    enabled: true,
  });
  config = withBundleAnalyzer(nextConfig);
}
```

### What to Look For

- Large dependencies that can be code-split
- Duplicate dependencies
- Unused code that can be tree-shaken
- Opportunities for lazy loading

---

## Image Optimizations

### Next.js Image Component

All images use the Next.js `Image` component:

```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Description"
  width={1200}
  height={630}
  priority  // For LCP images
  loading="lazy"  // For below-fold images
  placeholder="blur"  // For better UX
  blurDataURL="..."  // Base64 encoded placeholder
/>
```

### Image Configuration

In `next.config.mjs`:

```javascript
images: {
  formats: ['image/avif', 'image/webp'],  // Modern formats
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
}
```

### Benefits
- Automatic format conversion (WebP, AVIF)
- Responsive images with srcset
- Lazy loading by default
- Blur placeholder support
- Optimized compression

---

## Next.js Optimizations

### Compiler Optimizations

```javascript
// next.config.mjs
{
  swcMinify: true,  // SWC minification (faster than Terser)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}
```

### Benefits
- Faster minification
- Smaller bundle size
- Removed console.logs in production
- Optimized package imports

---

## Testing Performance

### Lighthouse Audit

1. **Local Testing:**
```bash
npm run build
npm run start
# Open Chrome DevTools > Lighthouse > Run audit
```

2. **CI/CD Integration:**
```bash
npm install -g @lhci/cli
lhci autorun
```

### WebPageTest

Test on: https://www.webpagetest.org/

### Key Metrics to Monitor

| Metric | Target | Current |
|--------|--------|---------|
| Performance Score | 90-100 | TBD |
| FCP | < 1.8s | TBD |
| LCP | < 2.5s | TBD |
| TBT | < 200ms | TBD |
| CLS | < 0.1 | TBD |
| SI | < 3.4s | TBD |

---

## Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "analyze": "ANALYZE=true npm run build",
    "lighthouse": "lhci autorun",
    "perf:mark": "node scripts/performance-marks.js"
  }
}
```

---

## Best Practices Checklist

- [ ] Use dynamic imports for heavy components
- [ ] Add loading skeletons for async components
- [ ] Preconnect to critical origins
- [ ] Optimize fonts with font-display: swap
- [ ] Use Next.js Image for all images
- [ ] Add priority to LCP images
- [ ] Configure service worker for offline support
- [ ] Enable React Query deduplication
- [ ] Monitor Web Vitals in production
- [ ] Run bundle analyzer regularly
- [ ] Test with Lighthouse before deployment
- [ ] Optimize third-party scripts
- [ ] Remove unused dependencies
- [ ] Enable SWC minification
- [ ] Configure proper cache headers

---

## Monitoring in Production

### Recommended Tools

1. **Vercel Analytics** (if deployed on Vercel)
2. **Google Analytics 4** with Web Vitals
3. **Sentry Performance Monitoring**
4. **New Relic Browser**
5. **DataDog RUM**

### Custom Analytics Integration

Update `src/lib/utils/performance.ts`:

```typescript
function sendMetricToAnalytics(metric: Metric) {
  // Your analytics service
  fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(metric),
  });
}
```

---

## Further Optimizations

### Consider Implementing:

1. **Preload Critical Resources**
   ```tsx
   <link rel="preload" href="/critical.css" as="style" />
   ```

2. **Resource Prioritization**
   ```tsx
   <script src="/script.js" fetchpriority="high" />
   ```

3. **Streaming SSR** (React 18+)
   ```tsx
   import { Suspense } from 'react';
   ```

4. **Edge Middleware** for static optimization
5. **CDN Configuration** with proper cache headers
6. **HTTP/2 Server Push** for critical resources
7. **Critical CSS Extraction** for above-fold content

---

## Troubleshooting

### Common Issues

**1. Large Bundle Size**
- Run bundle analyzer
- Check for duplicate dependencies
- Implement more code splitting

**2. Slow LCP**
- Optimize largest image
- Use priority loading
- Reduce render-blocking resources

**3. Poor CLS**
- Reserve space for images
- Use font-display: swap
- Avoid injecting content above existing content

**4. High TBT**
- Split long tasks
- Use code splitting
- Defer non-critical JavaScript

---

## Support

For questions or issues:
- Check Next.js docs: https://nextjs.org/docs
- React Query docs: https://tanstack.com/query
- Web.dev performance guides: https://web.dev/performance

---

## Version History

- **v1.0** - Initial performance optimizations implementation
- Added code splitting, service worker, performance monitoring
- Configured bundle analyzer and optimized caching strategies
