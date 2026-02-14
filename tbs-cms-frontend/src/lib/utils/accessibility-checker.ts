/**
 * Accessibility Validation Utilities
 * Check common accessibility issues
 */

interface A11yValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

/**
 * Check color contrast (simplified check)
 */
function checkColorContrast(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  // This is a simplified check - for production use a library like axe-core
  messages.push(
    'Manual color contrast check recommended with WebAIM Contrast Checker'
  );
  return { passed: true, messages };
}

/**
 * Check form labels
 */
function checkFormLabels(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]), select, textarea'
  );
  let unlabeled = 0;

  inputs.forEach((input) => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel =
      input.hasAttribute('aria-label') ||
      input.hasAttribute('aria-labelledby');

    if (!hasLabel && !hasAriaLabel) {
      unlabeled++;
      messages.push(
        `Form input without label: ${input.tagName.toLowerCase()}${input.id ? `#${input.id}` : ''}`
      );
    }
  });

  return {
    passed: unlabeled === 0,
    messages:
      unlabeled > 0
        ? [`${unlabeled} form inputs without proper labels`, ...messages]
        : ['All form inputs have labels'],
  };
}

/**
 * Check ARIA attributes
 */
function checkARIA(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];

  // Check for required ARIA attributes on interactive elements
  const buttons = document.querySelectorAll('button, [role="button"]');
  buttons.forEach((button) => {
    const text = button.textContent?.trim();
    const ariaLabel = button.getAttribute('aria-label');

    if (!text && !ariaLabel) {
      messages.push('Button without text or aria-label found');
    }
  });

  // Check for proper landmark roles
  const main = document.querySelector('main');
  const nav = document.querySelector('nav');
  const header = document.querySelector('header');

  if (!main) messages.push('No <main> landmark found');
  if (!nav) messages.push('No <nav> landmark found (recommended)');
  if (!header) messages.push('No <header> landmark found (recommended)');

  return { passed: messages.length === 0, messages };
}

/**
 * Check keyboard accessibility
 */
function checkKeyboardAccessibility(): {
  passed: boolean;
  messages: string[];
} {
  const messages: string[] = [];

  // Check for elements that should be focusable
  const interactive = document.querySelectorAll(
    'a, button, input, select, textarea, [tabindex]'
  );
  let negativeTabs = 0;

  interactive.forEach((el) => {
    const tabindex = el.getAttribute('tabindex');
    if (tabindex && parseInt(tabindex) < -1) {
      negativeTabs++;
    }
  });

  if (negativeTabs > 0) {
    messages.push(`${negativeTabs} elements with invalid tabindex found`);
  }

  // Check for skip link
  const skipLink = document.querySelector('a[href="#main-content"]');
  if (!skipLink) {
    messages.push('No skip-to-content link found (recommended)');
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Check heading structure
 */
function checkHeadingHierarchy(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.substring(1));

    if (previousLevel > 0 && level > previousLevel + 1) {
      messages.push(
        `Heading hierarchy skip: ${heading.tagName} after H${previousLevel}`
      );
    }

    previousLevel = level;
  });

  return { passed: messages.length === 0, messages };
}

/**
 * Check images for alt text
 */
function checkImageAlt(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const images = document.querySelectorAll('img');
  let missingAlt = 0;
  let emptyAlt = 0;

  images.forEach((img, index) => {
    if (!img.hasAttribute('alt')) {
      missingAlt++;
      messages.push(`Image ${index + 1} missing alt attribute`);
    } else {
      const alt = img.getAttribute('alt');
      if (alt === '') {
        emptyAlt++;
        // Empty alt is valid for decorative images
      }
    }
  });

  if (missingAlt > 0) {
    messages.push(`${missingAlt} images without alt attribute`);
  }

  return { passed: missingAlt === 0, messages };
}

/**
 * Check for proper language attribute
 */
function checkLanguage(): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const html = document.querySelector('html');
  const lang = html?.getAttribute('lang');

  if (!lang) {
    messages.push('Missing lang attribute on <html> element');
    return { passed: false, messages };
  }

  return { passed: true, messages: [`Language set to: ${lang}`] };
}

/**
 * Run all accessibility validations
 */
export function validateAccessibility(): A11yValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const checks = [
    checkColorContrast(),
    checkFormLabels(),
    checkARIA(),
    checkKeyboardAccessibility(),
    checkHeadingHierarchy(),
    checkImageAlt(),
    checkLanguage(),
  ];

  checks.forEach((check) => {
    totalChecks++;
    if (check.passed) {
      passedChecks++;
      warnings.push(...check.messages);
    } else {
      errors.push(...check.messages);
    }
  });

  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    score,
  };
}

/**
 * Print accessibility validation results to console
 */
export function printAccessibilityValidation() {
  const result = validateAccessibility();

  console.group('♿ Accessibility Validation Results');

  console.log(`Score: ${result.score}/100`);

  if (result.passed) {
    console.log('✅ All critical accessibility checks passed!');
  } else {
    console.log('❌ Some accessibility issues found');
  }

  if (result.errors.length > 0) {
    console.group('❌ Errors (must fix)');
    result.errors.forEach((error) => console.error(error));
    console.groupEnd();
  }

  if (result.warnings.length > 0) {
    console.group('⚠️ Warnings & Info');
    result.warnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }

  console.groupEnd();

  return result;
}
