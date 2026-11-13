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
  const link = row.exitUrl
    ? `<a class="cta" href="${escapeHtml(row.exitUrl)}" rel="nofollow sponsored noopener">Book / website</a>`
    : '';
  const dir = `<a class="ghost" href="${escapeHtml(row.directionsUrl)}" rel="nofollow noopener">Get directions</a>`;
  return `<li class="card"><h3>${escapeHtml(row.name)}</h3>${meta}${addr}<p class="src">${escapeHtml(row.honesty)}</p><div class="acts">${link}${dir}</div></li>`;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const list = rows.length
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
<link rel="stylesheet" href="/seo.css">
<script type="application/ld+json">${JSON.stringify(faq)}</script>
${itemList ? `<script type="application/ld+json">${JSON.stringify(itemList)}</script>` : ''}
</head><body><header><a href="/">Try1Second</a><nav><a href="/nearby">Nearby</a>${NEARBY_CATEGORIES.map((c) => `<a href="/nearby/${c}">${c}</a>`).join('')}</nav></header>
<main><h1>${escapeHtml(title)}</h1>
<p class="lead">Places around ${escapeHtml(label)}, closest first. Every card states where its data comes from. Clicks to a partner site go through our own tracked exit.</p>
${list}
${notes ? `<section class="notes"><h2>Data notes</h2><ul>${notes}</ul></section>` : ''}
<section class="faq"><h2>About this page</h2><p>Ratings and review counts come from Google Places when our key is configured. OpenStreetMap supplies names, addresses and coordinates and has no ratings at all, which is why those cards show distance only. We never invent a rating, a review count or a price.</p></section>
</main>
<footer><p><a href="/answers">All comparisons</a> &middot; <a href="/">Search prices</a></p></footer></body></html>`;
}
