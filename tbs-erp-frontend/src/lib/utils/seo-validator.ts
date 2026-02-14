/**
 * SEO Validation Utilities
 * Validate SEO elements on pages
 */

interface SEOValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

/**
 * Validate page title
 */
function validateTitle(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const title = document.title;

  if (!title) {
    return { passed: false, messages: ['Missing page title'] };
  }

  if (title.length < 30) {
    messages.push(`Title too short (${title.length} chars, recommended: 50-60)`);
  } else if (title.length > 60) {
    messages.push(
      `Title too long (${title.length} chars, recommended: 50-60)`
    );
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Validate meta description
 */
function validateMetaDescription(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const description = document.querySelector('meta[name="description"]');

  if (!description) {
    return { passed: false, messages: ['Missing meta description'] };
  }

  const content = description.getAttribute('content') || '';

  if (content.length < 120) {
    messages.push(
      `Meta description too short (${content.length} chars, recommended: 150-160)`
    );
  } else if (content.length > 160) {
    messages.push(
      `Meta description too long (${content.length} chars, recommended: 150-160)`
    );
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Validate headings structure
 */
function validateHeadings(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const h1s = document.querySelectorAll('h1');
  const h2s = document.querySelectorAll('h2');

  if (h1s.length === 0) {
    messages.push('No H1 heading found');
  } else if (h1s.length > 1) {
    messages.push(`Multiple H1 headings found (${h1s.length})`);
  }

  if (h2s.length === 0) {
    messages.push('No H2 headings found (recommended for content structure)');
  }

  return { passed: h1s.length === 1, messages };
}

/**
 * Validate images
 */
function validateImages(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const images = document.querySelectorAll('img');
  let missingAlt = 0;

  images.forEach((img, index) => {
    if (!img.hasAttribute('alt')) {
      missingAlt++;
      messages.push(`Image ${index + 1} missing alt attribute`);
    }
  });

  return {
    passed: missingAlt === 0,
    messages: [
      ...messages,
      `Total images: ${images.length}, Missing alt: ${missingAlt}`,
    ],
  };
}

/**
 * Validate links
 */
function validateLinks(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const links = document.querySelectorAll('a');
  let emptyLinks = 0;
  let externalWithoutRel = 0;

  links.forEach((link) => {
    const href = link.getAttribute('href');
    const text = link.textContent?.trim();

    if (!href || href === '#') {
      emptyLinks++;
    }

    if (!text) {
      messages.push('Link with no text found');
    }

    // Check external links
    if (href && (href.startsWith('http') || href.startsWith('//'))) {
      const rel = link.getAttribute('rel');
      if (!rel?.includes('noopener') || !rel?.includes('noreferrer')) {
        externalWithoutRel++;
      }
    }
  });

  if (emptyLinks > 0) {
    messages.push(`${emptyLinks} empty or placeholder links found`);
  }

  if (externalWithoutRel > 0) {
    messages.push(
      `${externalWithoutRel} external links without proper rel attributes`
    );
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Validate structured data
 */
function validateStructuredData(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  if (scripts.length === 0) {
    messages.push('No structured data (JSON-LD) found');
    return { passed: false, messages };
  }

  scripts.forEach((script, index) => {
    try {
      JSON.parse(script.textContent || '');
    } catch (e) {
      messages.push(`Invalid JSON-LD at script ${index + 1}`);
    }
  });

  return { passed: messages.length === 0, messages };
}

/**
 * Validate Open Graph tags
 */
function validateOpenGraph(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const requiredTags = ['og:title', 'og:description', 'og:image', 'og:url'];

  requiredTags.forEach((tag) => {
    const meta = document.querySelector(`meta[property="${tag}"]`);
    if (!meta) {
      messages.push(`Missing ${tag}`);
    }
  });

  return { passed: messages.length === 0, messages };
}

/**
 * Run all SEO validations
 */
export function validateSEO(): SEOValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Title validation
  const titleResult = validateTitle();
  if (!titleResult.passed) {
    errors.push(...titleResult.messages);
  } else {
    warnings.push(...titleResult.messages);
  }

  // Meta description validation
  const descResult = validateMetaDescription();
  if (!descResult.passed) {
    errors.push(...descResult.messages);
  } else {
    warnings.push(...descResult.messages);
  }

  // Headings validation
  const headingsResult = validateHeadings();
  if (!headingsResult.passed) {
    errors.push(...headingsResult.messages);
  } else {
    warnings.push(...headingsResult.messages);
  }

  // Images validation
  const imagesResult = validateImages();
  if (!imagesResult.passed) {
    warnings.push(...imagesResult.messages);
  } else {
    info.push(...imagesResult.messages);
  }

  // Links validation
  const linksResult = validateLinks();
  if (!linksResult.passed) {
    warnings.push(...linksResult.messages);
  }

  // Structured data validation
  const structuredDataResult = validateStructuredData();
  if (!structuredDataResult.passed) {
    warnings.push(...structuredDataResult.messages);
  }

  // Open Graph validation
  const ogResult = validateOpenGraph();
  if (!ogResult.passed) {
    warnings.push(...ogResult.messages);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

/**
 * Print SEO validation results to console
 */
export function printSEOValidation() {
  const result = validateSEO();

  console.group('📊 SEO Validation Results');

  if (result.passed) {
    console.log('✅ All critical SEO checks passed!');
  } else {
    console.log('❌ Some SEO issues found');
  }

  if (result.errors.length > 0) {
    console.group('❌ Errors (must fix)');
    result.errors.forEach((error) => console.error(error));
    console.groupEnd();
  }

  if (result.warnings.length > 0) {
    console.group('⚠️ Warnings (should fix)');
    result.warnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }

  if (result.info.length > 0) {
    console.group('ℹ️ Info');
    result.info.forEach((info) => console.info(info));
    console.groupEnd();
  }

  console.groupEnd();

  return result;
}
