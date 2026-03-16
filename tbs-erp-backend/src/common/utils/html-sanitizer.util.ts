/**
 * HTML Sanitizer Utility
 *
 * Uses isomorphic-dompurify (already in package.json) to strip XSS vectors
 * from user-submitted HTML content before persisting to the database.
 *
 * Allowed elements: block and inline elements safe for rich-text content.
 * Forbidden: <script>, <iframe>, <object>, event handlers, javascript: URLs.
 */
const DOMPurify = require('isomorphic-dompurify');

/** Tags allowed in sanitized HTML output. */
const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'code',
  'pre',
  'br',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'div',
  'span',
  'figure',
  'figcaption',
];

/** Attributes permitted on the allowed tags. */
const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'class',
  'id',
  'target',
  'rel',
  'colspan',
  'rowspan',
  'style',
];

/**
 * Sanitize an HTML string, removing all XSS vectors while preserving
 * safe rich-text markup.
 *
 * Passing `null` or `undefined` returns an empty string.
 * Passing a plain-text value (no HTML tags) returns it unchanged.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Strip dangerous URI schemes such as javascript: and data:
    ALLOWED_URI_REGEXP: /^(?:https?|ftp|mailto|tel|#):/i,
    // Remove DOM clobbering targets
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Do not allow data: URIs in any attribute
    ALLOW_DATA_ATTR: false,
    // Force all <a> links to be safe
    ADD_ATTR: ['target'],
  });
}

/**
 * Sanitize only if the value is a non-empty string; otherwise return the
 * original value unchanged.  Useful when a field is optional.
 */
export function sanitizeHtmlOptional(
  input: string | null | undefined,
): string | null | undefined {
  if (input == null) {
    return input;
  }
  return sanitizeHtml(input);
}
