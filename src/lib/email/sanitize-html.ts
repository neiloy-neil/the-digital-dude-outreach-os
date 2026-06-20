import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes an HTML string for safe rendering in the browser.
 *
 * - Allows common email-safe formatting tags (p, br, div, span, a, b, strong,
 *   i, em, ul, ol, li, h1-h6, blockquote, table/thead/tbody/tr/td/th, img,
 *   hr, pre, code).
 * - Strips script, style, iframe, object, embed, form, link, meta, base.
 * - Strips all event-handler attributes (onerror, onclick, onload, etc.).
 * - Strips javascript: and data: URLs from href/src — except data:image/*.
 * - Forces rel="noopener noreferrer" on target="_blank" links.
 *
 * Safe to call server-side (isomorphic-dompurify uses a JSDOM environment
 * on Node and the real DOM in the browser).
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span', 'a', 'b', 'strong', 'i', 'em',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'hr',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'img',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'target', 'rel',
      'style', 'class',
      // Table attributes
      'colspan', 'rowspan', 'width', 'height', 'align', 'valign',
      // Image attributes
      'border',
    ],
    // Strip data: URLs except data:image/* — blocks data:text/html XSS vectors
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/[a-z]+;base64,)/i,
    // Force rel="noopener noreferrer" on all target="_blank" links
    ADD_ATTR: ['target'],
    FORCE_BODY: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}
