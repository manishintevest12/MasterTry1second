/**
 * Responsive remote-image sizing (owner 22 Oct, 95+ Lighthouse / fast app):
 * offer art comes from arbitrary merchant CDNs (OYO 1.4MB photos, Agoda 700KB)
 * that ignore native resize params. wsrv.nl is a free, keyless resize proxy that
 * re-encodes to ~10KB WebP at the card's rendered size. Self-healing contract:
 * callers ALWAYS keep the raw URL as the first onError fallback — if the proxy
 * is ever unreachable, the card silently degrades to the original CDN image.
 * Only https URLs are proxied; relative paths, data: URIs and non-remote art
 * pass through untouched.
 */
export function scaledImage(url: string | null | undefined, w: number, h?: number): string | undefined {
  if (!url) return undefined;
  if (!/^https:\/\//i.test(url)) return url;
  const bare = url.replace(/^https:\/\//i, '');
  const params = new URLSearchParams({
    url: bare,
    w: String(w),
    q: '72',
    output: 'webp',
  });
  if (h) {
    params.set('h', String(h));
    params.set('fit', 'cover');
  }
  return `https://wsrv.nl/?${params.toString()}`;
}
