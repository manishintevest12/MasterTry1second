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
    // OWNER 9 Nov ("Content Signals declared"): state plainly how this content may be used, so an
    // agent does not have to guess. Search and reader-style answers are welcome; training on our
    // copy is not. This is a declaration, not an enforcement mechanism.
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    '',
    `Sitemap: ${SEO_HOST}/sitemap.xml`,
    `# Machine index: ${SEO_HOST}/llms.txt`,
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

/**
 * Warm sitemap (owner 28 Oct: GSC said "Couldn't fetch"): Google must never wait on MySQL.
 * The XML is built once at boot, written to disk, and served from memory; a background
 * refresh every 10 minutes keeps product URLs current. If the database is slow, restarting,
 * or down, the last good file is served instantly instead of an error — and a fetch that
 * arrives mid-deploy still succeeds.
 */
const WARM_FILE = 'data/sitemap-cache.xml';
const WARM_TTL_MS = 10 * 60_000;
type Warm = { xml: string; at: number; buckets?: Record<SitemapBucket, string>; counts?: Record<SitemapBucket, number> };
let warm: Warm | null = null;
let warming: Promise<string> | null = null;

function readWarmFile(): string | null {
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    if (fs.existsSync(WARM_FILE)) return fs.readFileSync(WARM_FILE, 'utf8');
  } catch { /* ignore */ }
  return null;
}

function writeWarmFile(xml: string): void {
  try {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    fs.mkdirSync(path.dirname(WARM_FILE), { recursive: true });
    fs.writeFileSync(WARM_FILE, xml);
  } catch { /* disk is optional */ }
}

function splitBuckets(paths: string[]): Record<SitemapBucket, string[]> {
  const out: Record<SitemapBucket, string[]> = { core: [], cities: [], products: [] };
  for (const p of paths) out[sitemapBucketOf(p)].push(p);
  return out;
}

/** Build every bucket, the index, and the counts the index needs to skip an empty bucket. */
function buildDocuments(paths: string[]): { index: string; buckets: Record<SitemapBucket, string>; counts: Record<SitemapBucket, number> } {
  const split = splitBuckets(paths);
  const counts = { core: split.core.length, cities: split.cities.length, products: split.products.length };
  return {
    index: sitemapIndexXml(counts),
    counts,
    buckets: { core: sitemapXml(split.core), cities: sitemapXml(split.cities), products: sitemapXml(split.products) },
  };
}

async function buildWarm(): Promise<string> {
  const extras = await productSitemapPaths().catch(() => [] as string[]);
  const docs = buildDocuments([...listSeoPaths(), ...extras]);
  warm = { xml: docs.index, at: Date.now(), buckets: docs.buckets, counts: docs.counts };
  writeWarmFile(docs.index);
  return docs.index;
}

/** Serve the sitemap instantly; refresh in the background when stale. */
export async function sitemapResponse(): Promise<string> {
  if (warm) {
    if (Date.now() - warm.at > WARM_TTL_MS && !warming) {
      warming = buildWarm().catch(() => warm!.xml).finally(() => { warming = null; }) as any;
    }
    return warm.xml;
  }
  const fromDisk = readWarmFile();
  if (fromDisk) {
    warm = { xml: fromDisk, at: Date.now() };
    warming = buildWarm().catch(() => fromDisk).finally(() => { warming = null; }) as any;
    return fromDisk;
  }
  warming = buildWarm().finally(() => { warming = null; }) as any;
  return warming as unknown as Promise<string>;
}

/** One bucket on its own URL (/sitemap-cities.xml and friends); rebuilds through the same warm pass. */
export async function bucketSitemapResponse(bucket: SitemapBucket): Promise<string> {
  await sitemapResponse();
  const cached = warm?.buckets?.[bucket];
  if (cached) return cached;
  // Cold and unbuilt (or a bucket that does not exist yet): build just this bucket from the live corpus.
  const extras = await productSitemapPaths().catch(() => [] as string[]);
  const split = splitBuckets([...listSeoPaths(), ...extras]);
  return sitemapXml(split[bucket]);
}

/** Boot/self-heal hook: warm the cache without making any request wait for it. */
export function warmSitemapSoon(): void {
  if (warm || warming) return;
  warming = buildWarm().catch(() => '').finally(() => { warming = null; }) as any;
}

/**
 * Sitemap dates and crawl priority.
 *
 * OWNER 10 Nov ("jo bacha hai usko fix kro"), defect found in the served sitemap: all 1,020 URLs carried
 * <lastmod> = today and <priority> = 0.8. A lastmod that moves every single day for every URL is the classic
 * signal Google learns to IGNORE, which costs us recrawl freshness exactly where it matters (city pages whose
 * prices change). So:
 *   - pages whose data actually churns (city and route pages) keep a daily lastmod,
 *   - static shells, answer pages and product pages get the release date (when we truly shipped content),
 *   - priority now expresses importance: home 1.0, vertical hubs 0.9, money categories and guides 0.8,
 *     city/route pages 0.7, answer pages 0.5, product pages 0.4.
 */
const RELEASE_DATE = (() => {
  const explicit = (process.env.T1S_RELEASE_DATE || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  try {
    const stat = require('node:fs').statSync(require('node:path').join(process.cwd(), 'dist', 'index.html'));
    return new Date(stat.mtimeMs).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

/** True when the page's own content is refreshed by live data (prices/fares), not only by a code release. */
function churnsDaily(path: string): boolean {
  if (path === '/' || !path.startsWith('/')) return true;
  if (/^\/(best|answers|guides|product|about|privacy|terms|contact)\b/.test(path)) return false;
  return path.split('/').filter(Boolean).length > 1;
}

const CITY_VERTICALS = ['hotels', 'cabs', 'grocery', 'food', 'movies'];
const METRO_CITIES = ['mumbai', 'delhi', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];

export function sitemapPriority(path: string): string {
  if (path === '/') return '1.0';
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 1) return '0.9'; // vertical hubs: /flights /hotels ...
  if (segs[0] === 'best' && segs.length === 2) return '0.8'; // money category answers
  if (segs[0] === 'guides') return '0.8'; // search-intent guides
  if (segs[0] === 'best') return '0.5'; // 481 state answers: keep, but do not chase crawl budget
  if (segs[0] === 'answers') return '0.5';
  if (segs[0] === 'product') return '0.4';
  // OWNER 10 Nov ("sb city sb place pr kro"): the corpus went from 38 to 525 places, so 2,620 city URLs now
  // exist. The eight metros keep the higher signal; the long tail is published and crawlable but does not
  // compete with the money pages for crawl budget until it proves it can earn an impression.
  if (CITY_VERTICALS.includes(segs[0]) && segs.length === 2) {
    return METRO_CITIES.includes(segs[1]) ? '0.7' : '0.5';
  }
  return '0.7'; // route pages
}

export type SitemapBucket = 'core' | 'cities' | 'products';

/** Which bucket a URL belongs to, so Search Console reports coverage per group instead of one 3,250-URL blob. */
export function sitemapBucketOf(path: string): SitemapBucket {
  const segs = path.split('/').filter(Boolean);
  if (segs[0] === 'product') return 'products';
  if (CITY_VERTICALS.includes(segs[0]) && segs.length === 2) return 'cities';
  return 'core';
}

export function sitemapXml(paths: string[] = listSeoPaths()): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...paths];
  const body = urls.map((p) => {
    const freq = churnsDaily(p) ? 'daily' : 'weekly';
    const pri = sitemapPriority(p);
    const lastmod = churnsDaily(p) ? today : RELEASE_DATE;
    return [
      '  <url>',
      `    <loc>${SEO_HOST}${p === '/' ? '/' : p}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${freq}</changefreq>`,
      `    <priority>${pri}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/**
 * OWNER 10 Nov: the corpus went to 525 places, so 2,620 new city URLs landed in one file next to the money
 * pages and the 200 product pages. A single 3,250-URL sitemap hides which half of the site Google actually
 * accepts; a sitemap index gives Search Console a per-bucket verdict (core, cities, products) and lets one
 * weak bucket be fixed without republishing the rest (the sitemap protocol allows 50k URLs / 50MB per file,
 * so this is a diagnostics win, not a limit workaround).
 */
export function sitemapIndexXml(buckets: Record<SitemapBucket, number>, today = new Date().toISOString().slice(0, 10)): string {
  const order: SitemapBucket[] = ['core', 'cities', 'products'];
  const body = order.filter((b) => (buckets[b] || 0) > 0).map((b) => [
    '  <sitemap>',
    `    <loc>${SEO_HOST}/sitemap-${b}.xml</loc>`,
    `    <lastmod>${b === 'core' ? RELEASE_DATE : today}</lastmod>`,
    '  </sitemap>',
  ].join('\n')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
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
    // Served from the warm cache (built at boot, refreshed every 10 min) so Google never
    // waits on MySQL and a fetch during a deploy still gets the last good file.
    res.send(await sitemapResponse());
  });
  for (const bucket of ['core', 'cities', 'products'] as SitemapBucket[]) {
    app.get(`/sitemap-${bucket}.xml`, async (_req: any, res: Response) => {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(await bucketSitemapResponse(bucket));
    });
  }
}
