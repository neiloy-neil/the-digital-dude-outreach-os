// Strips protocol/www/trailing slash so "https://Foo.com/", "www.foo.com",
// and "foo.com" all dedup against each other.
export function normalizeWebsiteForDedup(url: string | null | undefined): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}
