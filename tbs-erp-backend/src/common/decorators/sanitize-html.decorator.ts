import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

// Type definition for DOMPurify config
type DOMPurifyConfig = {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
  ALLOWED_URI_REGEXP?: RegExp;
  SANITIZE_DOM?: boolean;
  KEEP_CONTENT?: boolean;
  [key: string]: any;
};

/**
 * Decorator to sanitize HTML content and prevent XSS attacks
 *
 * Usage:
 * ```typescript
 * class CreatePostDto {
 *   @SanitizeHtml()
 *   @IsString()
 *   content: string;
 * }
 * ```
 *
 * This will automatically sanitize the HTML content before validation.
 * All potentially dangerous tags and attributes (script, iframe, onclick, etc.) are removed.
 */
export function SanitizeHtml(options?: DOMPurifyConfig) {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Default configuration: allow safe HTML tags only
    const defaultConfig: DOMPurifyConfig = {
      ALLOWED_TAGS: [
        // Text formatting
        'p',
        'br',
        'span',
        'div',
        'strong',
        'em',
        'u',
        's',
        'del',
        'ins',
        'mark',
        'small',
        'sub',
        'sup',
        // Headings
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        // Lists
        'ul',
        'ol',
        'li',
        // Links and media
        'a',
        'img',
        // Tables
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        // Blockquote and code
        'blockquote',
        'code',
        'pre',
        // HR
        'hr',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'target',
        'rel',
        'width',
        'height',
      ],
      // Remove all scripts and event handlers
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      // Keep safe URL schemes only
      ALLOWED_URI_REGEXP: /^(https?|mailto|tel|#):/i,
      // Prevent DOM clobbering
      SANITIZE_DOM: true,
      // Keep comments (optional - can be removed for stricter security)
      KEEP_CONTENT: true,
      ...options,
    };

    return DOMPurify.sanitize(value, defaultConfig);
  });
}

/**
 * Strict version that removes ALL HTML tags, keeping only text
 *
 * Usage:
 * ```typescript
 * class CreateCommentDto {
 *   @SanitizeHtmlStrict()
 *   @IsString()
 *   comment: string;
 * }
 * ```
 */
export function SanitizeHtmlStrict() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Strip all HTML tags
    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [], // No tags allowed
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Keep text content
    });
  });
}
