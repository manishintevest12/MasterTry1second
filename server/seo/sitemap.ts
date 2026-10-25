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

export function sitemapXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = listSeoPaths();
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
  app.get('/sitemap.xml', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(sitemapXml());
  });
}
