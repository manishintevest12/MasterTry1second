/**
 * Programmatic local-SEO pages for the Nearby vertical (owner 13 Nov):
 *   /nearby                          hub
 *   /nearby/<category>               category hub (restaurants, cafes, hotels, stays, cabs, stores)
 *   /nearby/<category>/<city>        e.g. /nearby/restaurants/pune
 *   /nearby/<category>/<city>/<area> e.g. /nearby/restaurants/pune/koregaon-park
 *
 * Pages are rendered from the SAME honest aggregator the API uses, so a page shows real names, distances
 * and (only when a provider supplies them) ratings and price levels. A city with no rows says so.
 */
import { INDIAN_CITIES, CITY_STATE } from '../seo/cityCorpus';
import { nearbyAnswer, normalizeNearbyCategory, type NearbyAnswer, type NearbyCategory } from './aggregator';

export const NEARBY_CATEGORIES: NearbyCategory[] = ['restaurants', 'cafes', 'hotels', 'stays', 'cabs', 'stores'];

export const NEARBY_AREAS: Record<string, string[]> = {
  pune: ['koregaon-park', 'baner', 'hinjewadi', 'viman-nagar'],
  mumbai: ['andheri', 'bandra', 'powai', 'lower-parel'],
  bengaluru: ['indiranagar', 'koramangala', 'whitefield', 'jayanagar'],
  delhi: ['connaught-place', 'saket', 'hauz-khas', 'dwarka'],
  hyderabad: ['gachibowli', 'banjara-hills', 'madhapur'],
};

const CITY_SLUGS = new Map<string, string>(); // slug -> real city name
for (const c of INDIAN_CITIES) CITY_SLUGS.set(c.slug, c.name);

const AREA_SLUGS = new Map<string, string>(); // area slug -> "Area, City"
for (const [citySlug, areas] of Object.entries(NEARBY_AREAS)) {
  const cityName = CITY_SLUGS.get(citySlug) || citySlug;
  for (const a of areas) AREA_SLUGS.set(`${citySlug}/${a}`, `${titleCase(a)}, ${cityName}`);
}

function titleCase(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface NearbyPage {
  path: string;
  category: NearbyCategory;
  city: string;
  areaLabel: string | null;
}

export function resolveNearbyPage(path: string): NearbyPage | null {
  const parts = String(path || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'nearby') return null;
  // The hub itself is a real page: it lists the categories and explains the data sources.
  if (parts.length === 1) return { path, category: 'all', city: '', areaLabel: null };
  const category = normalizeNearbyCategory(parts[1]);
  if (category === 'all' && parts[1] !== 'all') return null;
  if (parts.length === 2) return { path, category, city: '', areaLabel: null };
  const citySlug = String(parts[2] || '').toLowerCase();
  const city = CITY_SLUGS.get(citySlug);
  if (!city) return null;
  if (parts.length === 3) return { path, category, city, areaLabel: null };
  const areaLabel = AREA_SLUGS.get(`${citySlug}/${String(parts[3] || '').toLowerCase()}`);
  if (!areaLabel) return null;
  return { path, category, city, areaLabel };
}

/** Every nearby URL for the sitemap: 6 category hubs, 6 x cities, plus the hand-picked area pages. */
export function listNearbyPaths(): string[] {
  const paths = ['/nearby'];
  for (const c of NEARBY_CATEGORIES) paths.push(`/nearby/${c}`);
  const cities = [...CITY_SLUGS.keys()];
  for (const c of NEARBY_CATEGORIES) for (const city of cities) paths.push(`/nearby/${c}/${city}`);
  for (const key of AREA_SLUGS.keys()) {
    const citySlug = key.split('/')[0];
    for (const c of NEARBY_CATEGORIES) paths.push(`/nearby/${c}/${key}`);
    void citySlug;
  }
  return [...new Set(paths)];
}

function rupee(n: number | null): string | null {
  return n === null ? null : `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function card(row: NearbyAnswer['results'][number]): string {
  const bits: string[] = [];
  if (row.rating !== null) bits.push(`&#9733; ${row.rating.toFixed(1)}${row.ratingCount ? ` (${row.ratingCount})` : ''}`);
  if (row.distanceKm !== null) bits.push(`${row.distanceKm} km away`);
  if (row.priceLabel) bits.push(row.priceLabel);
  if (row.price !== null) bits.push(rupee(row.price) as string);
  const meta = bits.length ? `<p class="meta">${bits.join(' &middot; ')}</p>` : '<p class="meta">Distance from the searched point is shown when the map source carries coordinates.</p>';
  const addr = row.address ? `<p class="addr">${escapeHtml(row.address)}</p>` : '';
  const photo = row.imageUrl ? `<img class="ph" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.name)}" loading="lazy" width="320" height="200">` : '';
  const link = row.exitUrl
    ? `<a class="cta" href="${escapeHtml(row.exitUrl)}" rel="nofollow sponsored noopener">Book / website</a>`
    : '';
  const dir = `<a class="ghost" href="${escapeHtml(row.directionsUrl)}" rel="nofollow noopener">Get directions</a>`;
  return `<li class="card">${photo}<h3>${escapeHtml(row.name)}</h3>${meta}${addr}<p class="src">${escapeHtml(row.honesty)}</p><div class="acts">${link}${dir}</div></li>`;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * OWNER 16 Nov (Search Console: 2 Soft 404, 1,000 "Discovered - currently not indexed", 449 "Crawled - currently
 * not indexed"). Roughly half of the 3,258 /nearby/<category>/<city> pages rendered "we do not have live data,
 * this page lists nothing" with HTTP 200 and ~2.4 KB of body. To Google that is the textbook SOFT 404, and a
 * pile of near-identical thin pages teaches it to stop crawling the whole directory.
 *
 * The page now earns its place in the index: it needs real places, not a template and a city name.
 *  - MIN_INDEXABLE_ROWS or more real rows  -> indexable, listed in the sitemap.
 *  - fewer                                  -> still served (a visitor may land there) but `noindex, follow`,
 *                                              and kept OUT of the sitemap, so Google is never asked to judge it.
 * The sitemap cannot call the live aggregator for 3,000 pages at build time, so every render records its own
 * verdict here and the next sitemap rebuild drops what proved thin. It converges within a crawl cycle.
 */
export const MIN_INDEXABLE_ROWS = 6;
const thinPaths = new Set<string>();
const richPaths = new Set<string>();

/** True when a render of this path proved it had too little real content to be worth indexing. */
export function isKnownThinNearbyPath(path: string): boolean {
  return thinPaths.has(path);
}

function recordNearbyVerdict(path: string, rowCount: number): boolean {
  const rich = rowCount >= MIN_INDEXABLE_ROWS;
  if (rich) { richPaths.add(path); thinPaths.delete(path); } else { thinPaths.add(path); richPaths.delete(path); }
  return rich;
}

/**
 * Background audit: learn which nearby city pages are thin WITHOUT waiting for a visitor or a crawler to
 * discover it. It walks the corpus slowly (2 at a time, a pause between batches) so it never competes with real
 * traffic or trips the map providers' rate limits, reuses the aggregator's own cache (so a warm city costs
 * nothing), and records each verdict through the same gate the page uses. Idempotent and safe to call twice.
 */
let auditStarted = false;
export function startNearbyThinAudit(onDone?: () => void): void {
  if (auditStarted) return;
  auditStarted = true;
  const paths = listNearbyPaths().filter((p) => p.split('/').filter(Boolean).length >= 3);
  let i = 0;
  let done = 0;
  const worker = async () => {
    while (i < paths.length) {
      const path = paths[i]; i += 1;
      const page = resolveNearbyPage(path);
      if (!page) continue;
      try {
        const ans = await nearbyAnswer({ city: page.areaLabel || page.city, category: page.category, limit: 24 });
        recordNearbyVerdict(path, ans?.results?.length || 0);
        done += 1;
        // A live pass over the whole corpus takes hours against free map providers, so the sitemap is rebuilt
        // as verdicts land: every 150 pages, everything learned so far already leaves the sitemap. Waiting
        // for a finish line that a restart could erase would leave Google reading the old file for days.
        if (done % 150 === 0) { try { onDone?.(); } catch { /* best effort */ } }
      } catch { /* a failed lookup proves nothing, so it leaves the page's verdict untouched */ }
      await new Promise((r) => setTimeout(r, 400));
    }
  };
  void Promise.all([worker(), worker()]).then(() => { try { onDone?.(); } catch { /* best effort */ } });
}

/** City pages most worth showing on a hub: a hub with real links is a real page, not an empty state. */
const HUB_CITY_SLUGS = ['mumbai', 'delhi', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'indore', 'bhopal', 'chandigarh', 'surat', 'nagpur', 'kochi'];

function hubBody(page: NearbyPage): string {
  const cat = page.category === 'all' ? null : page.category;
  const catWord = cat || 'places';
  const cityLinks = HUB_CITY_SLUGS.filter((c) => CITY_SLUGS.has(c)).map((c) => {
    const name = CITY_SLUGS.get(c) as string;
    return cat
      ? `<li><a href="/nearby/${cat}/${c}">${escapeHtml(cat.charAt(0).toUpperCase() + cat.slice(1))} in ${escapeHtml(name)}</a></li>`
      : `<li><a href="/nearby/restaurants/${c}">${escapeHtml(name)}</a></li>`;
  }).join('');
  const catLinks = NEARBY_CATEGORIES.map((c) => `<li><a href="/nearby/${c}">Nearby ${c}</a></li>`).join('');
  return `<section><h2>How Nearby works</h2>
<p>Pick a city or let the app use your location, and Try1Second lists ${escapeHtml(catWord)} around that point, closest first. Names, addresses and distances come from open map data. Ratings, review counts and price levels appear only when a partner feed actually supplies them, so a card with no rating says so instead of showing an invented number.</p>
<p>Every "Book / website" button goes through our own tracked exit, and every card carries a directions link, so you can go from finding a place to being there without leaving the page.</p></section>
<section><h2>${cat ? `Browse ${escapeHtml(cat)} by city` : 'Browse by city'}</h2><ul class="links">${cityLinks}</ul></section>
${cat ? '' : `<section><h2>Browse by category</h2><ul class="links">${catLinks}</ul></section>`}`;
}

export async function renderNearbyHtml(page: NearbyPage, origin: string): Promise<string> {
  const label = page.areaLabel || page.city || 'your location';
  const catLabel = page.category === 'all' ? 'places' : page.category;
  const title = page.city
    ? `Best ${catLabel} near ${label} - live comparison | Try1Second`
    : `Nearby ${catLabel} - local discovery | Try1Second`;
  let answer: NearbyAnswer | null = null;
  if (page.city || page.areaLabel) {
    answer = await nearbyAnswer({ city: page.areaLabel || page.city, category: page.category, limit: 24 }).catch(() => null);
  }
  const rows = answer?.results || [];
  const isHub = !page.city && !page.areaLabel;
  // A hub has no city to query, so it used to render the "lists nothing" empty state on every visit. It now
  // renders real, link-rich content instead; a city page gets an honest verdict from how many rows it found.
  const indexable = isHub ? true : recordNearbyVerdict(page.path, rows.length);
  const list = isHub
    ? hubBody(page)
    : rows.length
      ? `<ul class="cards">${rows.map(card).join('')}</ul>`
      : `<p class="empty">We do not have live ${catLabel} data for ${escapeHtml(label)} right now, so this page lists nothing rather than invented ratings or prices. Search the same place on the
       <a href="/">comparison engine</a> for prices we actually hold.</p>`;
  const notes = (answer?.notes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How does Try1Second find ${catLabel} near ${label}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `We query live map and places data around the coordinates of ${label} and show each place with its distance. Ratings and price levels appear only when the source supplies them; OpenStreetMap rows carry name, address and distance only.`,
        },
      },
    ],
  };
  const itemList = rows.length ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 20).map((r, i) => ({
      '@type': 'ListItem', position: i + 1, name: r.name,
      ...(r.lat !== null && r.lng !== null ? { item: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}` } : {}),
    })),
  } : null;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="Live nearby ${escapeHtml(catLabel)} around ${escapeHtml(label)} with distance, rating and price level where the source actually provides them.">
<link rel="canonical" href="${origin}${page.path}">
${indexable ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex, follow">'}
<link rel="stylesheet" href="/seo.css">
<script type="application/ld+json">${JSON.stringify(faq)}</script>
${itemList ? `<script type="application/ld+json">${JSON.stringify(itemList)}</script>` : ''}
</head><body><header><a href="/">Try1Second</a><nav><a href="/nearby">Nearby</a>${NEARBY_CATEGORIES.map((c) => `<a href="/nearby/${c}">${c}</a>`).join('')}</nav></header>
<main><h1>${escapeHtml(title)}</h1>
<p class="lead">Places around ${escapeHtml(label)}, closest first. Every card states where its data comes from. Clicks to a partner site go through our own tracked exit.</p>
${list}
${notes ? `<section class="notes"><h2>Data notes</h2><ul>${notes}</ul></section>` : ''}
<section class="faq"><h2>About this page</h2><p>Names, addresses and distances come from open map data. Ratings, review counts and price levels appear only when a partner feed actually supplies them, so we never invent a rating, a review count or a price.</p></section>
</main>
<footer><p><a href="/answers">All comparisons</a> &middot; <a href="/">Search prices</a></p></footer></body></html>`;
}
