/**
 * Try1Second — SEO routes: /robots.txt and /sitemap.xml.
 * The URL corpus is derived from data.ts (self-healing: new verticals,
 * cities and routes flow into the sitemap automatically).
 */
import { Response } from 'express';
import { listSeoPaths, SEO_HOST } from './data';
import { privacyHtml, aboutHtml } from './staticPages';

export function robotsText(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /merchant',
    'Disallow: /api',
    'Disallow: /*?ref=', // referral codes — keep crawl budget on content
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    `Sitemap: ${SEO_HOST}/sitemap.xml`,
    '',
  ].join('\n');
}

/** Slug used by /product/<slug> SEO pages (lowercase, dashes, 3-80 chars). */
export function productSlug(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Product URLs for the sitemap, taken from our own catalogue (owner 28 Oct: "product
 * page ke liye v ye kr do"). Only real, verified offers become indexable pages, capped
 * so the sitemap stays small and fast. Cached for an hour.
 */
let productPathCache: { at: number; paths: string[] } | null = null;
export async function productSitemapPaths(limit = 200): Promise<string[]> {
  if (productPathCache && Date.now() - productPathCache.at < 3_600_000) return productPathCache.paths;
  let paths: string[] = [];
  try {
    const { findCatalogueOffers } = await import('../catalogue/catalogueService');
    const seen = new Set<string>();
    for (const v of ['ecommerce', 'grocery']) {
      const rows = await findCatalogueOffers(v, { limit: 200 }).catch(() => []);
      for (const r of rows as any[]) {
        const slug = productSlug(String(r.title || ''));
        if (slug.length < 3 || seen.has(slug)) continue;
        seen.add(slug);
        paths.push(`/product/${slug}`);
        if (paths.length >= limit) break;
      }
      if (paths.length >= limit) break;
    }
  } catch { paths = []; }
  productPathCache = { at: Date.now(), paths };
  return paths;
}

export function sitemapXml(extraPaths: string[] = []): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...listSeoPaths(), ...extraPaths];
  const body = urls.map((p) => {
    // Route and category pages refresh as fares move; static shells weekly.
    const deep = p.split('/').filter(Boolean).length > 1;
    const freq = deep ? 'daily' : 'weekly';
    const pri = p === '/' ? '1.0' : deep ? '0.8' : '0.6';
    return [
      '  <url>',
      `    <loc>${SEO_HOST}${p === '/' ? '/' : p}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${freq}</changefreq>`,
      `    <priority>${pri}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function registerSeoRoutes(app: { get: (p: string, h: (req: any, res: Response) => void) => void }) {
  // Standalone static pages (Play Store requires a public privacy policy URL).
  app.get('/privacy', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(privacyHtml());
  });
  app.get('/about', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(aboutHtml());
  });
  app.get('/robots.txt', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(robotsText());
  });
  app.get('/sitemap.xml', async (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Product pages are derived from the live catalogue, so the sitemap grows with real
    // offers only — never with invented URLs.
    const extras = await productSitemapPaths().catch(() => [] as string[]);
    res.send(sitemapXml(extras));
  });
}
