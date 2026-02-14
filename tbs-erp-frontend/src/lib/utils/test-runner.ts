/**
 * Comprehensive Testing Runner
 * Run all validation tests and generate report
 */

import { validateSEO } from './seo-validator';
import { validateAccessibility } from './accessibility-checker';
import { getWebVitals, calculatePerformanceScore } from './performance-monitor';

interface TestReport {
  timestamp: string;
  url: string;
  seo: {
    passed: boolean;
    score: number;
    errors: string[];
    warnings: string[];
  };
  accessibility: {
    passed: boolean;
    score: number;
    errors: string[];
    warnings: string[];
  };
  performance: {
    score: number;
    metrics: Record<string, number>;
  };
  overallScore: number;
}

/**
 * Run all tests and generate comprehensive report
 */
export function runAllTests(): TestReport {
  const seoResults = validateSEO();
  const a11yResults = validateAccessibility();
  const perfMetrics = getWebVitals();
  const perfScore = calculatePerformanceScore(perfMetrics);

  // Calculate SEO score
  const seoScore =
    seoResults.errors.length === 0
      ? 100 - seoResults.warnings.length * 5
      : 100 - seoResults.errors.length * 10 - seoResults.warnings.length * 5;

  // Calculate overall score
  const overallScore = Math.round(
    (seoScore * 0.3 + a11yResults.score * 0.4 + perfScore * 0.3)
  );

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    seo: {
      passed: seoResults.passed,
      score: Math.max(0, seoScore),
      errors: seoResults.errors,
      warnings: seoResults.warnings,
    },
    accessibility: {
      passed: a11yResults.passed,
      score: a11yResults.score,
      errors: a11yResults.errors,
      warnings: a11yResults.warnings,
    },
    performance: {
      score: perfScore,
      metrics: perfMetrics as Record<string, number>,
    },
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };

  return report;
}

/**
 * Print comprehensive test report to console
 */
export function printTestReport() {
  console.clear();
  console.log(
    '%c🎯 Comprehensive Test Report',
    'font-size: 20px; font-weight: bold; color: #4F46E5;'
  );
  console.log('='.repeat(60));

  const report = runAllTests();

  // Overall score with color
  const scoreColor =
    report.overallScore >= 90
      ? '#10B981'
      : report.overallScore >= 70
        ? '#F59E0B'
        : '#EF4444';

  console.log(
    `%c📊 Overall Score: ${report.overallScore}/100`,
    `font-size: 18px; font-weight: bold; color: ${scoreColor};`
  );
  console.log('');

  // SEO Section
  console.group(
    `%c🔍 SEO: ${report.seo.score}/100 ${report.seo.passed ? '✅' : '❌'}`,
    'font-size: 16px; font-weight: bold;'
  );
  if (report.seo.errors.length > 0) {
    console.group('❌ Critical Issues');
    report.seo.errors.forEach((error) => console.error(`• ${error}`));
    console.groupEnd();
  }
  if (report.seo.warnings.length > 0) {
    console.group('⚠️ Warnings');
    report.seo.warnings.slice(0, 5).forEach((warning) => console.warn(`• ${warning}`));
    if (report.seo.warnings.length > 5) {
      console.log(`... and ${report.seo.warnings.length - 5} more`);
    }
    console.groupEnd();
  }
  if (report.seo.passed && report.seo.warnings.length === 0) {
    console.log('✅ All SEO checks passed!');
  }
  console.groupEnd();
  console.log('');

  // Accessibility Section
  console.group(
    `%c♿ Accessibility: ${report.accessibility.score}/100 ${report.accessibility.passed ? '✅' : '❌'}`,
    'font-size: 16px; font-weight: bold;'
  );
  if (report.accessibility.errors.length > 0) {
    console.group('❌ Critical Issues');
    report.accessibility.errors.forEach((error) => console.error(`• ${error}`));
    console.groupEnd();
  }
  if (report.accessibility.warnings.length > 0) {
    console.group('⚠️ Warnings');
    report.accessibility.warnings
      .slice(0, 5)
      .forEach((warning) => console.warn(`• ${warning}`));
    if (report.accessibility.warnings.length > 5) {
      console.log(`... and ${report.accessibility.warnings.length - 5} more`);
    }
    console.groupEnd();
  }
  if (
    report.accessibility.passed &&
    report.accessibility.warnings.length === 0
  ) {
    console.log('✅ All accessibility checks passed!');
  }
  console.groupEnd();
  console.log('');

  // Performance Section
  console.group(
    `%c⚡ Performance: ${report.performance.score}/100`,
    'font-size: 16px; font-weight: bold;'
  );
  Object.entries(report.performance.metrics).forEach(([key, value]) => {
    if (value) {
      const formatted = value.toFixed(2);
      const status = getMetricStatus(key, value);
      console.log(`${status} ${key.toUpperCase()}: ${formatted}ms`);
    }
  });
  console.groupEnd();
  console.log('');

  console.log('='.repeat(60));
  console.log(`Report generated at: ${new Date(report.timestamp).toLocaleString('vi-VN')}`);
  console.log('');

  // Recommendations
  if (report.overallScore < 90) {
    console.group('💡 Recommendations');
    if (report.seo.score < 90) {
      console.log('• Fix SEO issues for better search engine visibility');
    }
    if (report.accessibility.score < 90) {
      console.log('• Improve accessibility for better user experience');
    }
    if (report.performance.score < 90) {
      console.log('• Optimize performance for faster page loads');
    }
    console.groupEnd();
  }

  return report;
}

/**
 * Get metric status emoji
 */
function getMetricStatus(metric: string, value: number): string {
  const thresholds: Record<string, { good: number; moderate: number }> = {
    ttfb: { good: 600, moderate: 800 },
    fcp: { good: 1800, moderate: 3000 },
    lcp: { good: 2500, moderate: 4000 },
    fid: { good: 100, moderate: 300 },
    cls: { good: 0.1, moderate: 0.25 },
  };

  const threshold = thresholds[metric.toLowerCase()];
  if (!threshold) return '📊';

  if (value <= threshold.good) return '✅';
  if (value <= threshold.moderate) return '⚠️';
  return '❌';
}

/**
 * Export report as JSON
 */
export function exportReportAsJSON(report?: TestReport): string {
  const data = report || runAllTests();
  return JSON.stringify(data, null, 2);
}

/**
 * Save report to localStorage
 */
export function saveReport(key: string = 'test-report'): void {
  if (typeof window === 'undefined') return;

  const report = runAllTests();
  localStorage.setItem(key, JSON.stringify(report));
  console.log(`Report saved to localStorage with key: ${key}`);
}

/**
 * Load report from localStorage
 */
export function loadReport(key: string = 'test-report'): TestReport | null {
  if (typeof window === 'undefined') return null;

  const data = localStorage.getItem(key);
  if (!data) return null;

  return JSON.parse(data);
}

/**
 * Compare two reports
 */
export function compareReports(
  oldReport: TestReport,
  newReport: TestReport
): void {
  console.group('📈 Report Comparison');

  const scoreDiff = newReport.overallScore - oldReport.overallScore;
  console.log(
    `Overall Score: ${oldReport.overallScore} → ${newReport.overallScore} (${scoreDiff > 0 ? '+' : ''}${scoreDiff})`
  );

  console.log('\nSEO:', oldReport.seo.score, '→', newReport.seo.score);
  console.log(
    'Accessibility:',
    oldReport.accessibility.score,
    '→',
    newReport.accessibility.score
  );
  console.log(
    'Performance:',
    oldReport.performance.score,
    '→',
    newReport.performance.score
  );

  console.groupEnd();
}
