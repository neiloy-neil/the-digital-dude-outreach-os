export function htmlToPlainText(value: string): string {
  const normalized = String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  return normalized
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeDraftHtml(value?: string | null): string {
  const input = String(value || '').trim();
  if (!input) return '<p><br></p>';
  if (/<[a-z][\s\S]*>/i.test(input)) return input;

  const paragraphs = input
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      `<p>${paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('<br>')}</p>`
    );

  return paragraphs.length > 0 ? paragraphs.join('') : '<p><br></p>';
}

function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#6b7280;">
      If you do not want more emails, you can unsubscribe <a href="${unsubscribeUrl.replace(/"/g, '&quot;')}">here</a>.
    </p>
  `;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }

  return `${html}${footer}`;
}

export function buildEmailMessageBodies(body: string, unsubscribeUrl: string) {
  const normalizedHtml = normalizeDraftHtml(body);
  const htmlWithUnsubscribe = normalizedHtml.includes('{{unsubscribe_url}}')
    ? normalizedHtml.replace(/\{\{unsubscribe_url\}\}/g, `<span style="font-size:12px;color:#6b7280;display:block;margin-top:24px;">If you do not want more emails, you can <a href="${unsubscribeUrl.replace(/"/g, '&quot;')}">unsubscribe here</a>.</span>`)
    : /unsubscribe/i.test(normalizedHtml) || normalizedHtml.includes(unsubscribeUrl)
      ? normalizedHtml
      : appendUnsubscribeFooter(normalizedHtml, unsubscribeUrl);

  const htmlWrapped = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; }
    p { margin: 0 0 1em 0; }
    ul, ol { margin: 0 0 1em 0; padding-left: 24px; }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin-bottom: 0.25em; }
    a { color: #2563eb; text-decoration: underline; }
    b, strong { font-weight: bold; }
    i, em { font-style: italic; }
    u { text-decoration: underline; }
  </style>
</head>
<body>
${htmlWithUnsubscribe}
</body>
</html>`;

  const plainText = htmlToPlainText(htmlWithUnsubscribe);
  const textWithUnsubscribe = /unsubscribe/i.test(plainText) || plainText.includes(unsubscribeUrl)
    ? plainText
    : `${plainText}\n\nUnsubscribe: ${unsubscribeUrl}`;

  return {
    html: htmlWrapped,
    text: textWithUnsubscribe,
  };
}
