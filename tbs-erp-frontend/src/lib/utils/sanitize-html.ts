import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize search highlight snippets.
 * Only <mark> and <strong> are permitted — everything else is stripped.
 * Use this for server-returned highlight fields rendered with dangerouslySetInnerHTML.
 */
export function sanitizeHighlight(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['mark', 'strong'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify with a safe default configuration.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
      'a', 'img', 'figure', 'figcaption',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span', 'section', 'article',
      'video', 'source', 'iframe',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'width', 'height', 'loading',
      'class', 'id', 'style',
      'colspan', 'rowspan',
      'frameborder', 'allowfullscreen', 'allow',
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}
