/**
 * Indexable result snapshots (owner 28 Oct): "results pages ko agar index kar de ...
 * tho results aur fast ho jaayega? agar haan tho aise kr do".
 *
 * Indexing by itself does not make results faster. What DOES make them faster is
 * putting real, cached prices in the HTML the browser receives FIRST: the page then
 * paints prices before React mounts, and the live scan simply upgrades them. Google
 * also gets a crawlable price list instead of an empty shell, which is what brings
 * the traffic that makes the whole exercise worth doing.
 *
 * So every indexable SEO page (vertical landings, city pages, route pages) now gets:
 *   - a short "latest verified prices" list rendered in static HTML
 *   - an ItemList/Product JSON-LD block carrying the same prices
 *   - an honest "as of <time>" stamp, so nobody reads stale data as live
 * Snapshots are cached in memory per path for SNAPSHOT_TTL_MS and never invented:
 * if the catalogue has nothing for that page, the block is simply omitted.
 */
import { resolveAppRoute, resolveSeoPage } from './data';

export interface SnapshotRow {
  title: string;
  seller: string;
  price: number;
  url?: string | null;
}

export interface PageSnapshot {
  rows: SnapshotRow[];
  updatedAt: string;
}

const SNAPSHOT_TTL_MS = 10 * 60_000;
const MAX_ROWS = 6;
const cache = new Map<string, { at: number; snap: PageSnapshot | null }>();

const esc = (s: string) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Words that identify where a row belongs (a route, a city) — used to keep the list relevant. */
function placementTokens(path: string): string[] {
  const prod = /^\/product\/([a-z0-9-]{3,80})$/.exec(path.replace(/\/+$/, ''));
  if (prod) {
    // Product page: the slug itself is the query ("/product/iphone-15-128gb").
    return prod[1].split('-').filter((t) => t.length > 1 && !/^(the|and|for|with)$/.test(t));
  }
  const route = resolveAppRoute(path);
  // Drop parenthesised airport codes first: "Indore (IDR) to Delhi (DEL)" must ask the
  // row for the CITIES, not for the literal strings "idr"/"del".
  const hint = `${route?.query || ''}`.replace(/\([^)]*\)/g, ' ').toLowerCase();
  return hint.replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 2 && !/^\d+$/.test(t));
}

/**
 * Pick the rows worth showing for this page: cheapest first, one per seller, and —
 * for route/city pages — only rows that actually mention the route or city.
 */
export function selectSnapshotRows(candidates: SnapshotRow[], path: string, max = MAX_ROWS): SnapshotRow[] {
  const tokens = placementTokens(path);
  const relevant = tokens.length
    ? candidates.filter((r) => {
      const t = ` ${r.title.toLowerCase()} ${String(r.seller || '').toLowerCase()} `;
      return tokens.every((tok) => t.includes(tok));
    })
    : candidates;
  // A route-specific page with no route-specific rows shows nothing rather than
  // someone else's route: a wrong price is worse than no price.
  const pool = tokens.length ? relevant : candidates;
  const seen = new Set<string>();
  const out: SnapshotRow[] = [];
  for (const r of [...pool].sort((a, b) => a.price - b.price)) {
    const k = r.seller.toLowerCase().trim() || r.title.toLowerCase().trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Static HTML for the snapshot block. Returns '' when there is nothing honest to show. */
export function renderSnapshotHtml(snapshot: PageSnapshot | null, heading = 'Latest verified prices'): string {
  if (!snapshot || !snapshot.rows.length) return '';
  const items = snapshot.rows.map((r) => `
    <li style="display:flex;gap:10px;align-items:baseline;justify-content:space-between;border-bottom:1px solid #eef2f7;padding:7px 0">
      <span style="min-width:0;font-size:13.5px;color:#111827">${esc(r.title)}</span>
      <span style="white-space:nowrap;font-size:13.5px;font-weight:800;color:#111827">${esc(inr(r.price))}</span>
      <span style="white-space:nowrap;font-size:12px;color:#6b7280">${esc(r.seller)}</span>
    </li>`).join('');
  return [
    `<section style="font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:0 16px 8px">`,
    `<h2 style="font-size:15px;margin:18px 0 6px">${esc(heading)}</h2>`,
    `<ul style="list-style:none;padding:0;margin:0">${items}</ul>`,
    `<p style="font-size:11.5px;color:#9ca3af;margin:8px 0 0">Verified ${esc(new Date(snapshot.updatedAt).toUTCString())} · lowest first · seller links open through Try1Second</p>`,
    `</section>`,
  ].join('');
}

/** JSON-LD ItemList with real offers, so search engines can read the prices. */
export function snapshotJsonLd(snapshot: PageSnapshot | null, path: string): string | null {
  if (!snapshot || !snapshot.rows.length) return null;
  const page = resolveSeoPage(path);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page ? page.title : 'Try1Second live prices',
    itemListElement: snapshot.rows.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: r.title,
        offers: {
          '@type': 'Offer',
          price: Math.round(r.price),
          priceCurrency: 'INR',
          seller: { '@type': 'Organization', name: r.seller },
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  });
}

/**
 * Catalogue-backed snapshot for a path, cached for 10 minutes. Returns null when the
 * page is not an indexable SEO page, or when we hold no verified row for it.
 */
export async function snapshotForPath(path: string): Promise<PageSnapshot | null> {
  const page = resolveSeoPage(path);
  if (!page) return null;
  const key = (path || '/').replace(/\/+$/, '') || '/';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit.snap;
  let snap: PageSnapshot | null = null;
  try {
    const route = resolveAppRoute(path);
    const prod = /^\/product\/([a-z0-9-]{3,80})$/.exec(key);
    const vertical = route?.vertical || (prod ? 'ecommerce' : '');
    if (vertical) {
      const { findCatalogueOffers } = await import('../catalogue/catalogueService');
      const rows = await findCatalogueOffers(vertical, { limit: 120 }).catch(() => []);
      const candidates: SnapshotRow[] = rows
        .map((r: any) => ({
          title: String(r.title || ''),
          seller: String(r.seller || r.vendor || ''),
          price: Number(r.effective_price ?? r.mandatory_total ?? 0) || 0,
          url: r.seller_url || null,
        }))
        .filter((r) => r.price > 0 && r.title && r.seller);
      const picked = selectSnapshotRows(candidates, key);
      if (picked.length) snap = { rows: picked, updatedAt: new Date().toISOString() };
    }
  } catch {
    snap = null; // never break the page for a snapshot
  }
  cache.set(key, { at: Date.now(), snap });
  return snap;
}

/** Test/cron hook: drop the memory cache (a fresh crawl should not wait 10 minutes). */
export function clearSnapshotCache(): void {
  cache.clear();
}
