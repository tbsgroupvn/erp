/**
 * Generic DOM scraping engine with fallback selectors.
 * Tries each selector in order and returns the first match.
 */

export interface SelectorMap {
  title: string[];
  price: string[];
  images: string[];
  shopName: string[];
}

/** Try multiple selectors, return text content of the first match */
export function queryText(selectors: string[]): string | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) {
        return el.textContent.trim();
      }
    } catch {
      // Invalid selector, skip
    }
  }
  return null;
}

/** Try multiple selectors, return the first matching element */
export function queryElement(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      // Invalid selector, skip
    }
  }
  return null;
}

/** Collect all image URLs from multiple selectors */
export function queryImages(selectors: string[]): string[] {
  const urls = new Set<string>();

  for (const sel of selectors) {
    try {
      const elements = document.querySelectorAll(sel);
      elements.forEach((el) => {
        const src =
          el.getAttribute('src') ||
          el.getAttribute('data-src') ||
          el.getAttribute('data-lazy-src');
        if (src && !src.includes('data:image')) {
          // Normalize URL
          const url = src.startsWith('//') ? `https:${src}` : src;
          urls.add(url.split('?')[0]); // Remove query params for dedup
        }
      });
    } catch {
      // Invalid selector, skip
    }
  }

  return Array.from(urls);
}

/** Parse price string like "¥ 12.50" or "12.50" → 12.5 */
export function parsePrice(text: string | null): number | null {
  if (!text) return null;
  // Remove currency symbols and non-numeric chars except dots and commas
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Wait for DOM to be ready (useful for SPAs like Taobao).
 * Uses MutationObserver to detect when key content is loaded.
 */
export function waitForElement(
  selectors: string[],
  timeout = 10000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check immediately
    const existing = queryElement(selectors);
    if (existing) {
      resolve(existing);
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);

    const observer = new MutationObserver(() => {
      const el = queryElement(selectors);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
