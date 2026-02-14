/**
 * Performance Monitoring Utilities
 * Track and analyze performance metrics
 */

interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  domContentLoaded?: number;
  loadComplete?: number;
}

/**
 * Get Web Vitals metrics
 */
export function getWebVitals(): PerformanceMetrics {
  const metrics: PerformanceMetrics = {};

  if (typeof window === 'undefined' || !window.performance) {
    return metrics;
  }

  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming;

  if (navigation) {
    metrics.ttfb = navigation.responseStart - navigation.requestStart;
    metrics.domContentLoaded =
      navigation.domContentLoadedEventEnd - navigation.fetchStart;
    metrics.loadComplete = navigation.loadEventEnd - navigation.fetchStart;
  }

  // Get paint timing
  const paintEntries = performance.getEntriesByType('paint');
  paintEntries.forEach((entry) => {
    if (entry.name === 'first-contentful-paint') {
      metrics.fcp = entry.startTime;
    }
  });

  return metrics;
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(
  metrics: PerformanceMetrics
): number {
  let score = 100;

  // Deduct points for slow metrics
  if (metrics.fcp && metrics.fcp > 1800) score -= 20;
  else if (metrics.fcp && metrics.fcp > 1000) score -= 10;

  if (metrics.lcp && metrics.lcp > 2500) score -= 25;
  else if (metrics.lcp && metrics.lcp > 1000) score -= 10;

  if (metrics.fid && metrics.fid > 100) score -= 20;
  else if (metrics.fid && metrics.fid > 50) score -= 10;

  if (metrics.cls && metrics.cls > 0.25) score -= 20;
  else if (metrics.cls && metrics.cls > 0.1) score -= 10;

  if (metrics.ttfb && metrics.ttfb > 800) score -= 15;
  else if (metrics.ttfb && metrics.ttfb > 600) score -= 5;

  return Math.max(0, score);
}

/**
 * Get resource timing information
 */
export function getResourceTiming() {
  if (typeof window === 'undefined' || !window.performance) {
    return [];
  }

  const resources = performance.getEntriesByType('resource');
  return resources.map((resource: PerformanceEntry) => {
    const r = resource as PerformanceResourceTiming;
    return {
      name: r.name,
      type: r.initiatorType,
      duration: r.duration,
      size: r.transferSize || 0,
      startTime: r.startTime,
    };
  });
}

/**
 * Get largest resources by size
 */
export function getLargestResources(count: number = 10) {
  const resources = getResourceTiming();
  return resources
    .sort((a, b) => b.size - a.size)
    .slice(0, count)
    .map((r) => ({
      name: r.name.split('/').pop() || r.name,
      size: `${(r.size / 1024).toFixed(2)} KB`,
      duration: `${r.duration.toFixed(2)} ms`,
    }));
}

/**
 * Get slowest resources by duration
 */
export function getSlowestResources(count: number = 10) {
  const resources = getResourceTiming();
  return resources
    .sort((a, b) => b.duration - a.duration)
    .slice(0, count)
    .map((r) => ({
      name: r.name.split('/').pop() || r.name,
      size: `${(r.size / 1024).toFixed(2)} KB`,
      duration: `${r.duration.toFixed(2)} ms`,
    }));
}

/**
 * Monitor page load performance
 */
export function monitorPageLoad(callback: (metrics: PerformanceMetrics) => void) {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    // Wait for metrics to be collected
    setTimeout(() => {
      const metrics = getWebVitals();
      callback(metrics);
    }, 0);
  });
}

/**
 * Print performance report to console
 */
export function printPerformanceReport() {
  const metrics = getWebVitals();
  const score = calculatePerformanceScore(metrics);

  console.group('⚡ Performance Report');

  console.log(`Performance Score: ${score}/100`);

  console.group('📊 Web Vitals');
  if (metrics.ttfb) {
    console.log(
      `TTFB: ${metrics.ttfb.toFixed(2)}ms ${metrics.ttfb < 600 ? '✅' : '⚠️'}`
    );
  }
  if (metrics.fcp) {
    console.log(
      `FCP: ${metrics.fcp.toFixed(2)}ms ${metrics.fcp < 1800 ? '✅' : '⚠️'}`
    );
  }
  if (metrics.lcp) {
    console.log(
      `LCP: ${metrics.lcp.toFixed(2)}ms ${metrics.lcp < 2500 ? '✅' : '⚠️'}`
    );
  }
  if (metrics.domContentLoaded) {
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
  }
  if (metrics.loadComplete) {
    console.log(`Load Complete: ${metrics.loadComplete.toFixed(2)}ms`);
  }
  console.groupEnd();

  console.group('🐌 Slowest Resources (Top 5)');
  getSlowestResources(5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.name} - ${r.duration}`);
  });
  console.groupEnd();

  console.group('📦 Largest Resources (Top 5)');
  getLargestResources(5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.name} - ${r.size}`);
  });
  console.groupEnd();

  console.groupEnd();

  return { metrics, score };
}

/**
 * Measure function execution time
 */
export function measureExecutionTime<T>(
  fn: () => T,
  label: string = 'Function'
): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${label} took ${(end - start).toFixed(2)}ms`);
  return result;
}

/**
 * Create performance observer for specific entry types
 */
export function observePerformance(
  entryType: string,
  callback: (entries: PerformanceEntry[]) => void
) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });
    observer.observe({ entryTypes: [entryType] });
    return observer;
  } catch (e) {
    console.warn(`Performance observer for ${entryType} not supported`, e);
  }
}
