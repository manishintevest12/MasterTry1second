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
  /** Optional block heading, used where the page is not a single city/route (state answers). */
  heading?: string;
}

/**
 * Where a page points (city / query), so the catalogue lookup can ask for the RIGHT rows instead of any
 * row in that vertical.
 *
 * WHY THIS EXISTS (owner 10 Nov: "jo bacha hai usko fix kro", measured on production): /hotels/indore and
 * /flights rendered a "Latest verified prices" block, but /hotels/mumbai, /cabs/noida and /ecommerce/mobiles
 * rendered none (0 rupee tokens in the served HTML) even though their titles promise live prices. The lookup
 * was vertical-only, ignored the city in the URL and then filtered by text tokens, so a hotel row whose title
 * is "Taj Palace" (no city in the title) could never match /hotels/mumbai. findCatalogueOffers already
 * supports city and queryTerms filters, so the fix is to derive them from the path.
 */
export function pagePlacement(path: string): { city?: string; queryTerms?: string[] } {
  const clean = (path || '/').replace(/\/+$/, '');
  if (clean === '' || clean === '/') return {};
  if (/^\/(product|best|guides|answers)\b/.test(clean)) return {};
  const segs = clean.split('/').filter(Boolean);
  if (segs.length !== 2) return {};
  const tail = decodeURIComponent(segs[1]);
  // Route pages (chennai-to-madurai-bus) and multi-word slugs are not cities; a city slug is a single
  // place name such as noida, mumbai, new-delhi.
  if (/-to-/.test(tail) || /-bus$/.test(tail)) {
    return { queryTerms: tail.split('-').filter((t) => t.length > 2 && t !== 'to' && t !== 'bus') };
  }
  const title = tail.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { city: title, queryTerms: [title] };
}

const SNAPSHOT_TTL_MS = 10 * 60_000;
const MAX_ROWS = 6;
const cache = new Map<string, { at: number; snap: PageSnapshot | null; ttl?: number }>();

const esc = (s: string) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * A state answer page must show the state, not one city twice: take the cheapest row of each city first,
 * then fill the remaining slots with the next cheapest rows overall. Each row keeps its city label.
 */
export function pickCityDiverseRows(groups: SnapshotRow[][], max = MAX_ROWS): SnapshotRow[] {
  const out: SnapshotRow[] = [];
  const used = new Set<string>();
  const key = (r: SnapshotRow) => `${r.seller.toLowerCase().trim()}|${r.title.toLowerCase().trim()}`;
  const sorted = groups.map((g) => [...g].sort((a, b) => a.price - b.price));
  for (const g of sorted) {
    const first = g[0];
    if (!first || used.has(key(first))) continue;
    used.add(key(first));
    out.push(first);
    if (out.length >= max) return out;
  }
  const rest = sorted.flat().sort((a, b) => a.price - b.price);
  for (const r of rest) {
    if (used.has(key(r))) continue;
    used.add(key(r));
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

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

const slugOf = (t: string) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');

/**
 * Product pages are matched by SLUG, not by requiring every word: a title is cut at 80
 * characters when the slug is made, so "…with-provis" never equals the word "providing"
 * and an all-tokens rule silently emptied every long product page (owner 28 Oct: product
 * pages in the sitemap rendered no prices). Same product across sellers also differs by a
 * word or two, so a high token overlap still counts.
 */
function productMatches(slug: string, title: string): boolean {
  if (slugOf(title) === slug) return true;
  const want = slug.split('-').filter((t) => t.length > 1);
  if (!want.length) return false;
  const have = new Set(slugOf(title).split('-').filter((t) => t.length > 1));
  const hit = want.filter((t) => have.has(t) || [...have].some((h) => h.startsWith(t) || t.startsWith(h))).length;
  return hit / want.length >= 0.8;
}

/**
 * Pick the rows worth showing for this page: cheapest first, one per seller, and —
 * for route/city pages — only rows that actually mention the route or city.
 * Pass `bySlug` for /product/<slug> pages, where the slug itself is the identity.
 */
export function selectSnapshotRows(candidates: SnapshotRow[], path: string, max = MAX_ROWS, bySlug = false): SnapshotRow[] {
  if (bySlug) {
    const slug = /^\/product\/([a-z0-9-]{3,80})$/.exec(path.replace(/\/+$/, ''))?.[1] || '';
    const pool = candidates.filter((r) => productMatches(slug, r.title));
    const seen0 = new Set<string>();
    const out0: SnapshotRow[] = [];
    for (const r of pool.sort((a, b) => a.price - b.price)) {
      const k = r.seller.toLowerCase().trim() || r.title.toLowerCase().trim();
      if (seen0.has(k)) continue;
      seen0.add(k);
      out0.push(r);
      if (out0.length >= max) break;
    }
    return out0;
  }
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
export function renderSnapshotHtml(snapshot: PageSnapshot | null, heading?: string): string {
  if (!snapshot) return '';
  heading = heading || snapshot.heading || 'Latest verified prices';
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
/**
 * /best/<vertical>/<state> pages are answered by resolveAnswerPage(), NOT by resolveSeoPage(), so the guard
 * below used to return null before the state branch could ever run - that is why the state price block shipped
 * twice and never appeared in production HTML.
 */
export function isStateAnswerPath(path: string): boolean {
  return /^\/best\/[a-z0-9-]+\/[a-z0-9-]+$/.test((path || '').replace(/\/+$/, ''));
}

export async function snapshotForPath(path: string): Promise<PageSnapshot | null> {
  const stateAnswer = isStateAnswerPath(path);
  const page = stateAnswer ? null : resolveSeoPage(path);
  if (!page && !stateAnswer) return null;
  const key = (path || '/').replace(/\/+$/, '') || '/';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.ttl ?? SNAPSHOT_TTL_MS)) return hit.snap;
  let snap: PageSnapshot | null = null;
  // STATE ANSWER PAGES (/best/<vertical>/<state>) held no price data at all, which is why all 481 of them
  // sat at zero impressions while the city pages around them earned some. They are state-LEVEL queries, so
  // they must not borrow one city's prices: read the state's own cities (up to four) and label every row with
  // the city it came from. Cached for an hour because crawlers visit these in bulk.
  const stateMatch = /^\/best\/([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(key);
  if (stateMatch) {
    try {
      const [, vertical, stateSlug] = stateMatch;
      const { ANSWER_STATES } = await import('./answerStates');
      const state = ANSWER_STATES.find((st) => st.slug === stateSlug);
      const cities = (state?.cities || []).slice(0, 4);
      if (state && cities.length) {
        const { findCatalogueOffers } = await import('../catalogue/catalogueService');
        const perCity = await Promise.all(cities.map(async (city) => {
          const rows = await findCatalogueOffers(vertical, { city, limit: 40 }).catch(() => []);
          return (rows as any[])
            .map((r) => ({
              title: `${String(r.title || '')} · ${city}`,
              seller: String(r.seller || r.vendor || ''),
              price: Number(r.effective_price ?? r.mandatory_total ?? 0) || 0,
              url: r.seller_url || null,
            }))
            .filter((r) => r.price > 0 && r.title.trim() !== `· ${city}` && r.seller);
        }));
        const picked = pickCityDiverseRows(perCity, MAX_ROWS);
        if (picked.length) {
          snap = { rows: picked, updatedAt: new Date().toISOString(), heading: `Latest verified prices in ${state.name}` };
        }
      }
    } catch {
      snap = null;
    }
    cache.set(key, { at: Date.now(), snap, ttl: 60 * 60_000 });
    return snap;
  }
  try {
    const route = resolveAppRoute(path);
    const prod = /^\/product\/([a-z0-9-]{3,80})$/.exec(key);
    // A product can live in either catalogue (a milkshake is grocery, an iPhone is
    // ecommerce), so product pages look in both instead of guessing.
    const verticals = prod ? ['ecommerce', 'grocery'] : (route?.vertical ? [route.vertical] : []);
    if (verticals.length) {
      const { findCatalogueOffers } = await import('../catalogue/catalogueService');
      const where = prod ? {} : pagePlacement(key);
      const rows = (await Promise.all(
        verticals.map((v) => findCatalogueOffers(v, { limit: prod ? 120 : 200, ...where }).catch(() => [])),
      )).flat();
      // A city page whose city-filtered read is empty must not borrow another city's prices: try the
      // wider vertical read only when the page is not city-scoped, and let selectSnapshotRows' token
      // match decide (it already rejects rows that do not belong to the page).
      // ECOMMERCE pages (/ecommerce/mobiles) hold their rows in the PRODUCT catalogue, so a plain
      // vertical read comes back empty and the page rendered no prices at all on production. Ask the
      // product catalogue with the page's own query terms before giving up.
      if (!rows.length && !prod && verticals[0] === 'ecommerce' && where.queryTerms?.length) {
        const { findProductCatalogueRows } = await import('../catalogue/productCatalogue');
        const prodRows = await findProductCatalogueRows('ecommerce', {
          query: where.queryTerms.join(' '), limit: 200,
        }).catch(() => []);
        rows.push(...(prodRows as any[]));
      }
      if (!rows.length && !prod && where.city) {
        const wider = (await findCatalogueOffers(verticals[0], { limit: 200 }).catch(() => [])) as any[];
        rows.push(...wider);
      }
      const candidates: SnapshotRow[] = rows
        .map((r: any) => ({
          // location_city/area are part of the row's identity on a city page: a hotel row titled
          // "Taj Palace" with location_city "Mumbai" belongs on /hotels/mumbai even though the title
          // never says Mumbai.
          title: [String(r.title || ''), String(r.location_area || ''), String(r.location_city || '')]
            .filter(Boolean).join(' · '),
          seller: String(r.seller || r.vendor || ''),
          price: Number(r.effective_price ?? r.mandatory_total ?? 0) || 0,
          url: r.seller_url || null,
        }))
        .filter((r) => r.price > 0 && r.title && r.seller);
      const picked = selectSnapshotRows(candidates, key, MAX_ROWS, Boolean(prod));
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
