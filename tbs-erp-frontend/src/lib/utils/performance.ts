/**
 * Performance monitoring utilities for Web Vitals tracking
 * Integrates with Next.js performance monitoring
 */

export type Metric = {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
};

// Web Vitals thresholds (in milliseconds)
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 }, // First Input Delay
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint
};

/**
 * Rate the metric based on its value
 */
function getRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Log Web Vitals to console in development
 */
function logMetricToConsole(metric: Metric) {
  const emoji =
    metric.rating === 'good'
      ? '✅'
      : metric.rating === 'needs-improvement'
        ? '⚠️'
        : '❌';

  console.log(
    `${emoji} ${metric.name}:`,
    metric.value.toFixed(2),
    `(${metric.rating})`
  );
}

/**
 * Send metric to analytics service
 * Replace with your analytics provider (Google Analytics, Vercel Analytics, etc.)
 */
function sendMetricToAnalytics(metric: Metric) {
  // Example: Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }

  // Example: Vercel Analytics (if installed)
  if (typeof window !== 'undefined' && window.va) {
    window.va('track', metric.name, {
      value: metric.value,
      rating: metric.rating,
    });
  }

  // You can also send to your own analytics endpoint
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
    fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {
      // Silently fail - don't impact user experience
    });
  }
}

/**
 * Main function to report Web Vitals
 * Use this in your app component or layout
 */
export function reportWebVitals(metric: Metric) {
  // Add rating to metric
  const enhancedMetric = {
    ...metric,
    rating: getRating(metric.name, metric.value),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logMetricToConsole(enhancedMetric);
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    sendMetricToAnalytics(enhancedMetric);
  }
}

/**
 * Performance observer for custom metrics
 */
export function observePerformance() {
  if (typeof window === 'undefined') return;

  // Monitor long tasks (> 50ms)
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn('Long task detected:', {
              duration: entry.duration,
              name: entry.name,
            });
          }
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Browser doesn't support longtask
    }
  }
}

/**
 * Measure custom performance marks
 */
export function measurePerformance(name: string, startMark: string, endMark?: string) {
  if (typeof window === 'undefined' || !window.performance) return;

  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.mark(endMark || `${startMark}-end`);
      performance.measure(name, startMark, endMark || `${startMark}-end`);
    }

    const measure = performance.getEntriesByName(name)[0];
    if (measure && process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  } catch (e) {
    console.error('Performance measurement error:', e);
  }
}

/**
 * Create a performance mark
 */
export function markPerformance(name: string) {
  if (typeof window === 'undefined' || !window.performance) return;
  performance.mark(name);
}
