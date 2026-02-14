/**
 * Browser Testing Script
 * Copy and paste this entire script into browser console (F12) to run all tests
 *
 * Usage:
 * 1. Open your website in browser
 * 2. Press F12 to open console
 * 3. Copy this entire file and paste into console
 * 4. Tests will run automatically
 */

(function() {
  'use strict';

  console.clear();
  console.log('%c🎯 Starting Comprehensive Tests...', 'font-size: 20px; font-weight: bold; color: #4F46E5;');
  console.log('='.repeat(80));

  // ========================================
  // SEO VALIDATION
  // ========================================
  function validateSEO() {
    const errors = [];
    const warnings = [];
    const info = [];

    // Title
    const title = document.title;
    if (!title) {
      errors.push('Missing page title');
    } else if (title.length < 30) {
      warnings.push(`Title too short: ${title.length} chars (recommended: 50-60)`);
    } else if (title.length > 60) {
      warnings.push(`Title too long: ${title.length} chars (recommended: 50-60)`);
    } else {
      info.push(`Title: ${title.length} chars ✅`);
    }

    // Meta description
    const description = document.querySelector('meta[name="description"]');
    if (!description) {
      errors.push('Missing meta description');
    } else {
      const content = description.getAttribute('content') || '';
      if (content.length < 120) {
        warnings.push(`Meta description too short: ${content.length} chars`);
      } else if (content.length > 160) {
        warnings.push(`Meta description too long: ${content.length} chars`);
      } else {
        info.push(`Meta description: ${content.length} chars ✅`);
      }
    }

    // Headings
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      errors.push('No H1 heading found');
    } else if (h1s.length > 1) {
      warnings.push(`Multiple H1 headings found: ${h1s.length}`);
    } else {
      info.push('H1 heading: 1 ✅');
    }

    // Images
    const images = document.querySelectorAll('img');
    let missingAlt = 0;
    images.forEach(img => {
      if (!img.hasAttribute('alt')) missingAlt++;
    });
    if (missingAlt > 0) {
      warnings.push(`${missingAlt} images without alt attribute`);
    }
    info.push(`Total images: ${images.length}, Missing alt: ${missingAlt}`);

    // Structured data
    const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    if (jsonLd.length === 0) {
      warnings.push('No structured data (JSON-LD) found');
    } else {
      info.push(`Structured data scripts: ${jsonLd.length} ✅`);
    }

    // Open Graph
    const ogTags = ['og:title', 'og:description', 'og:image', 'og:url'];
    ogTags.forEach(tag => {
      if (!document.querySelector(`meta[property="${tag}"]`)) {
        warnings.push(`Missing ${tag}`);
      }
    });

    const score = errors.length === 0 ? 100 - warnings.length * 5 : 100 - errors.length * 10 - warnings.length * 5;

    return { passed: errors.length === 0, score: Math.max(0, score), errors, warnings, info };
  }

  // ========================================
  // ACCESSIBILITY VALIDATION
  // ========================================
  function validateAccessibility() {
    const errors = [];
    const warnings = [];
    let checks = 0;
    let passed = 0;

    // Form labels
    checks++;
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    let unlabeled = 0;
    inputs.forEach(input => {
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
      if (!hasLabel && !hasAriaLabel) unlabeled++;
    });
    if (unlabeled === 0) {
      passed++;
      warnings.push(`Form inputs: ${inputs.length}, All labeled ✅`);
    } else {
      errors.push(`${unlabeled} form inputs without proper labels`);
    }

    // Landmarks
    checks++;
    const main = document.querySelector('main');
    const nav = document.querySelector('nav');
    if (main) {
      passed++;
      warnings.push('Main landmark found ✅');
    } else {
      errors.push('No <main> landmark found');
    }

    // Skip link
    checks++;
    const skipLink = document.querySelector('a[href="#main-content"]');
    if (skipLink) {
      passed++;
      warnings.push('Skip-to-content link found ✅');
    } else {
      warnings.push('No skip-to-content link (recommended)');
    }

    // Images
    checks++;
    const images = document.querySelectorAll('img');
    let missingAlt = 0;
    images.forEach(img => {
      if (!img.hasAttribute('alt')) missingAlt++;
    });
    if (missingAlt === 0) {
      passed++;
      warnings.push(`Images: ${images.length}, All have alt ✅`);
    } else {
      errors.push(`${missingAlt} images without alt attribute`);
    }

    // Language
    checks++;
    const html = document.querySelector('html');
    const lang = html?.getAttribute('lang');
    if (lang) {
      passed++;
      warnings.push(`Language: ${lang} ✅`);
    } else {
      errors.push('Missing lang attribute on <html>');
    }

    // Heading hierarchy
    checks++;
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let hierarchyIssues = 0;
    let prevLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.substring(1));
      if (prevLevel > 0 && level > prevLevel + 1) {
        hierarchyIssues++;
      }
      prevLevel = level;
    });
    if (hierarchyIssues === 0) {
      passed++;
      warnings.push('Heading hierarchy correct ✅');
    } else {
      errors.push(`${hierarchyIssues} heading hierarchy issues`);
    }

    const score = Math.round((passed / checks) * 100);

    return { passed: errors.length === 0, score, errors, warnings };
  }

  // ========================================
  // PERFORMANCE METRICS
  // ========================================
  function getPerformanceMetrics() {
    if (!window.performance) {
      return { metrics: {}, score: 0 };
    }

    const metrics = {};
    const navigation = performance.getEntriesByType('navigation')[0];

    if (navigation) {
      metrics.ttfb = navigation.responseStart - navigation.requestStart;
      metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      metrics.loadComplete = navigation.loadEventEnd - navigation.fetchStart;
    }

    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      if (entry.name === 'first-contentful-paint') {
        metrics.fcp = entry.startTime;
      }
    });

    // Calculate score
    let score = 100;
    if (metrics.fcp && metrics.fcp > 1800) score -= 20;
    else if (metrics.fcp && metrics.fcp > 1000) score -= 10;
    if (metrics.ttfb && metrics.ttfb > 800) score -= 15;
    else if (metrics.ttfb && metrics.ttfb > 600) score -= 5;

    return { metrics, score: Math.max(0, score) };
  }

  // ========================================
  // RUN ALL TESTS
  // ========================================
  const seoResults = validateSEO();
  const a11yResults = validateAccessibility();
  const perfResults = getPerformanceMetrics();

  const overallScore = Math.round(
    seoResults.score * 0.3 + a11yResults.score * 0.4 + perfResults.score * 0.3
  );

  const scoreColor = overallScore >= 90 ? '#10B981' : overallScore >= 70 ? '#F59E0B' : '#EF4444';

  // ========================================
  // PRINT RESULTS
  // ========================================
  console.log('');
  console.log(`%c📊 OVERALL SCORE: ${overallScore}/100`, `font-size: 24px; font-weight: bold; color: ${scoreColor};`);
  console.log('');

  // SEO Section
  console.group(`%c🔍 SEO: ${seoResults.score}/100 ${seoResults.passed ? '✅' : '❌'}`, 'font-size: 16px; font-weight: bold;');
  if (seoResults.errors.length > 0) {
    console.group('❌ Critical Issues');
    seoResults.errors.forEach(e => console.error(`• ${e}`));
    console.groupEnd();
  }
  if (seoResults.warnings.length > 0) {
    console.group('⚠️ Warnings');
    seoResults.warnings.forEach(w => console.warn(`• ${w}`));
    console.groupEnd();
  }
  if (seoResults.info.length > 0) {
    console.group('ℹ️ Info');
    seoResults.info.forEach(i => console.info(`• ${i}`));
    console.groupEnd();
  }
  console.groupEnd();
  console.log('');

  // Accessibility Section
  console.group(`%c♿ Accessibility: ${a11yResults.score}/100 ${a11yResults.passed ? '✅' : '❌'}`, 'font-size: 16px; font-weight: bold;');
  if (a11yResults.errors.length > 0) {
    console.group('❌ Critical Issues');
    a11yResults.errors.forEach(e => console.error(`• ${e}`));
    console.groupEnd();
  }
  if (a11yResults.warnings.length > 0) {
    console.group('ℹ️ Info');
    a11yResults.warnings.forEach(w => console.info(`• ${w}`));
    console.groupEnd();
  }
  console.groupEnd();
  console.log('');

  // Performance Section
  console.group(`%c⚡ Performance: ${perfResults.score}/100`, 'font-size: 16px; font-weight: bold;');
  Object.entries(perfResults.metrics).forEach(([key, value]) => {
    const formatted = value.toFixed(2);
    const thresholds = {
      ttfb: { good: 600, moderate: 800 },
      fcp: { good: 1800, moderate: 3000 },
    };
    const threshold = thresholds[key.toLowerCase()];
    let status = '📊';
    if (threshold) {
      if (value <= threshold.good) status = '✅';
      else if (value <= threshold.moderate) status = '⚠️';
      else status = '❌';
    }
    console.log(`${status} ${key.toUpperCase()}: ${formatted}ms`);
  });
  console.groupEnd();
  console.log('');

  console.log('='.repeat(80));
  console.log(`Report generated at: ${new Date().toLocaleString('vi-VN')}`);
  console.log('');

  // Recommendations
  if (overallScore < 90) {
    console.group('💡 Recommendations');
    if (seoResults.score < 90) console.log('• Fix SEO issues for better search visibility');
    if (a11yResults.score < 90) console.log('• Improve accessibility for better UX');
    if (perfResults.score < 90) console.log('• Optimize performance for faster loads');
    console.groupEnd();
    console.log('');
  }

  // Return report object
  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    seo: seoResults,
    accessibility: a11yResults,
    performance: perfResults,
    overallScore
  };
})();
