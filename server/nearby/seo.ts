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
import { INDEXABLE_METROS } from '../seo/indexPolicy';
import { categoryLabel } from './categories';
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


/**
 * The nearby pages asked for /seo.css, a file nothing has ever served - so every one of them rendered as
 * browser-default HTML with a 404 asset in the network log (bad LCP, bad CLS, and a broken reference Google
 * follows). The styles are inline now: no extra request, no flash of unstyled content on a 2G phone.
 */
const NEARBY_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827;background:#fff}
header{border-bottom:1px solid #e5e7eb;padding:12px 20px;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
header a{font-weight:800;color:#b91c1c;text-decoration:none}
header nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
main{max-width:900px;margin:0 auto;padding:22px 18px 60px}
a{color:#b91c1c;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:clamp(22px,4vw,30px);line-height:1.25;margin:6px 0 10px}
h2{font-size:18px;margin:26px 0 10px}
.crumbs{font-size:13px;color:#6b7280;margin-bottom:14px}
.lead{color:#374151;margin:0 0 18px}
.cards{list-style:none;padding:0;margin:0;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:6px;background:#fff}
.card h3{margin:0;font-size:16.5px}
.card .meta{margin:0;font-size:13px;color:#4b5563}
.card .addr{margin:0;font-size:12.5px;color:#6b7280}
.card .src{margin:0;font-size:12px;color:#6b7280}
.card .acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:8px;font-size:14px}
.card .ph{width:100%;height:150px;object-fit:cover;border-radius:10px}
.ph{background:#f3f4f6}
.empty{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px}
.notes{font-size:13px;color:#4b5563}
.links{columns:2;column-gap:24px;list-style:none;padding:0;font-size:14.5px}
.links li{margin:0 0 8px}
.faq details{border-bottom:1px solid #e5e7eb;padding:10px 0}
.faq summary{font-weight:650;cursor:pointer}
footer{border-top:1px solid #e5e7eb;padding:18px;text-align:center;font-size:13.5px;color:#4b5563}
@media(max-width:560px){.links{columns:1}}
`;

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

/**
 * OWNER 16 Nov ('finish whatever left in seo and keep improving the site rankings'): the sitemap used to list
 * every nearby city URL that had not PROVED thin, which in practice meant all 3,265 of them on the first boot,
 * because a fresh process knows nothing and 'not proved thin' was read as 'probably fine'. The sitemap now asks
 * the opposite question - has this page been measured with real places in it? Only a yes is listed, so the file
 * Google fetches contains pages that will survive the crawl. Hubs are always listed: they are hand-built and
 * link-rich.
 */
export function isRichNearbyPath(path: string): boolean {
  return richPaths.has(path);
}

function recordNearbyVerdict(path: string, rowCount: number, floor: number = MIN_INDEXABLE_ROWS): boolean {
  const rich = rowCount >= floor;
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
  // OWNER 16 Nov: this audit used to walk ALL 3,265 nearby city pages, two at a time, which is exactly what
  // tripped Nominatim's rate limit and left categories empty for everyone (the API notes said so: 'Nominatim
  // answered 429'). It now proves the pages that matter at boot - the metros this product is used in, every
  // category - slowly enough to be a polite client, and leaves the long tail to earn its verdict when a crawler
  // or a visitor actually opens it (recordNearbyVerdict runs on every render).
  const paths = listNearbyPaths().filter((p) => {
    const segs = p.split('/').filter(Boolean);
    return segs.length === 3 && HUB_CITY_SLUGS.includes(segs[2]);
  });
  let i = 0;
  let done = 0;
  const worker = async () => {
    while (i < paths.length) {
      const path = paths[i]; i += 1;
      const page = resolveNearbyPage(path);
      if (!page) continue;
      try {
        const ans = await nearbyAnswer({ city: page.areaLabel || page.city, category: page.category, limit: 24, preferFull: true, noPhotos: true });
        recordNearbyVerdict(path, ans?.results?.length || 0);
        done += 1;
        // The sitemap is rebuilt as verdicts land, so everything proved so far is already published.
        if (done % 20 === 0) { try { onDone?.(); } catch { /* best effort */ } }
      } catch { /* a failed lookup proves nothing, so it leaves the page's verdict untouched */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };
  void worker().then(() => { try { onDone?.(); } catch { /* best effort */ } });
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

/** What people actually search for, per category. A title says 'cinemas', not 'movies'. */
const CATEGORY_NOUN: Partial<Record<NearbyCategory, { one: string; many: string }>> = {
  restaurants: { one: 'restaurant', many: 'restaurants' },
  cafes: { one: 'cafe', many: 'cafes' },
  hotels: { one: 'hotel', many: 'hotels' },
  stays: { one: 'stay', many: 'stays and guest houses' },
  cabs: { one: 'cab service', many: 'cab services' },
  stores: { one: 'shop', many: 'shops and supermarkets' },
  movies: { one: 'cinema', many: 'cinemas' },
  all: { one: 'place', many: 'places' },
};

function prettyCategory(cat: NearbyCategory): string {
  // OWNER 17 Nov: the new chips (petrol, puncture, RTO, ...) carry their own label, so the page copy never falls
  // back to a generic 'places' for a real, indexed category.
  return CATEGORY_NOUN[cat]?.many || categoryLabel(cat).toLowerCase();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stateNameFor(cityName: string): string | null {
  const slug = CITY_STATE[String(cityName || '').trim().toLowerCase()];
  if (!slug) return null;
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Deterministic sibling links so a crawler walks the whole local cluster from any entry point. */
function relatedLinks(page: NearbyPage): string {
  const citySlug = String(page.city || '').toLowerCase().replace(/\s+/g, '-');
  const others = [...CITY_SLUGS.keys()].filter((c) => c !== citySlug);
  const sameCityOtherCats = NEARBY_CATEGORIES.filter((c) => c !== page.category)
    .map((c) => `<li><a href="/nearby/${c}/${citySlug}">${escapeHtml(prettyCategory(c))} in ${escapeHtml(page.city)}</a></li>`).join('');
  // Six cities: the metros first (they have demand), then the alphabetical neighbours of this city's slug so the
  // cluster is stable and crawlable rather than random per request.
  const picks = [...HUB_CITY_SLUGS.filter((c) => c !== citySlug && CITY_SLUGS.has(c)), ...others.sort()].slice(0, 6);
  const cityLinks = picks.map((c) => `<li><a href="/nearby/${page.category}/${c}">${escapeHtml(prettyCategory(page.category))} in ${escapeHtml(CITY_SLUGS.get(c) as string)}</a></li>`).join('');
  // Only URLs that exist: the comparison verticals are hotels, cabs, movies, grocery, food. A link to a 404 is
  // worse than no link (it spends crawl budget and leaves a soft 404 in Search Console).
  const comparePath = ({ hotels: '/hotels', cabs: '/cabs', movies: '/movies', stores: '/grocery', restaurants: '/food', cafes: '/food' } as Record<string, string>)[page.category];
  const compareLink = comparePath
    ? `<li><a href="${comparePath}/${citySlug}">Compare ${escapeHtml(prettyCategory(page.category))} prices in ${escapeHtml(page.city)}</a></li>`
    : '';
  return `<section class="links-wrap"><h2>More ${escapeHtml(prettyCategory(page.category))} in ${escapeHtml(page.city)}</h2>
<ul class="links">${sameCityOtherCats}</ul>
<h2>${escapeHtml(prettyCategory(page.category))} in other cities</h2>
<ul class="links">${cityLinks}</ul>
<h2>Compare prices before you go</h2>
<ul class="links">${compareLink}<li><a href="/nearby">All nearby categories</a></li><li><a href="/answers">Every comparison we run</a></li></ul></section>`;
}

export async function renderNearbyHtml(page: NearbyPage, origin: string): Promise<string> {
  const label = page.areaLabel || page.city || 'your location';
  const noun = CATEGORY_NOUN[page.category] || { one: categoryLabel(page.category).replace(/s$/, '').toLowerCase(), many: categoryLabel(page.category).toLowerCase() };
  const catLabel = noun?.many || categoryLabel(page.category).toLowerCase();
  const isHub = !page.city && !page.areaLabel;
  const citySlug = String(page.city || '').toLowerCase().replace(/\s+/g, '-');
  let answer: NearbyAnswer | null = null;
  if (page.city || page.areaLabel) {
    // Crawlers get the whole answer (preferFull), so a cold render cannot brand a rich page as thin.
    // OWNER 16 Nov (Search Console access log: /nearby/cabs/nahan held for 14,464ms and answered 503): a page
    // render gets the full build but only 2.5s of it. A crawler that can see the page in 2.5s is worth more than
    // one that waits out the proxy and gets an error page.
    answer = await nearbyAnswer({ city: page.areaLabel || page.city, category: page.category, limit: 24, preferFull: true, budgetMs: 2500 }).catch(() => null);
  }
  const rows = answer?.results || [];
  // A page render is allowed to be cut short, so an empty answer here proves nothing: it is never recorded as
  // thin (only the boot audit, which has the full budget, may call a page thin). A rich answer is always
  // recorded, so the sitemap promotes the page the moment it is genuinely full.
  // OWNER 16 Nov: Indore has exactly 5 cinemas on the map. A flat floor of 6 called that page thin, which is
  // the wrong answer for the one city where the list is complete and people actually search. The metros the
  // product is used in get a floor of 4; the long tail still needs 6.
  const floor = page.city && INDEXABLE_METROS.has(citySlug) ? 4 : MIN_INDEXABLE_ROWS;
  const indexable = isHub ? true : (rows.length >= floor ? recordNearbyVerdict(page.path, rows.length, floor) : (isRichNearbyPath(page.path) ? true : false));
  const state = stateNameFor(page.city);
  const placeOf = state && !page.areaLabel ? `${page.city}, ${state}` : label;
  const names = rows.slice(0, 3).map((r) => r.name).filter(Boolean);

  // Titles and descriptions are built from what is ON the page: a count and real names, so two city pages never
  // say the same thing to a searcher (the old template did, 3,258 times).
  const title = isHub
    ? `${page.category === 'all' ? 'Nearby places' : `${prettyCategory(page.category)} nearby`} in Indian cities - addresses, distance | Try1Second`
    : rows.length
      ? `${rows.length} ${rows.length === 1 ? noun.one : catLabel} near ${label} - addresses and distance | Try1Second`
      : `${cap(prettyCategory(page.category))} near ${label} - addresses and distance | Try1Second`;
  const h1 = isHub
    ? (page.category === 'all' ? 'Nearby places in India' : `${prettyCategory(page.category)} nearby, city by city`)
    : `${rows.length ? `${rows.length} ` : ''}${cap(rows.length === 1 ? noun.one : catLabel)} near ${label}`;
  const description = isHub
    ? `Pick a city and see the ${catLabel} around it, closest first, with address and distance. Ratings and prices only where a real source publishes them.`
    : rows.length
      ? `${rows.length} ${catLabel} around ${placeOf}, closest first${names.length ? `: ${names.join(', ')}` : ''}. Address and distance from open map data; ratings and prices only where a source actually publishes them.`
      : `We have no live ${catLabel} data for ${placeOf} right now. Rather than invent ratings or prices we list nothing until a real source answers.`;

  const list = isHub
    ? hubBody(page)
    : rows.length
      ? `<ul class="cards">${rows.map(card).join('')}</ul>`
      : `<p class="empty">We do not have live ${catLabel} data for ${escapeHtml(label)} right now, so this page lists nothing rather than invented ratings or prices. Search the same place on the
       <a href="/">comparison engine</a> for prices we actually hold.</p>`;
  const notes = (answer?.notes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  const crumbs: Array<{ name: string; path: string }> = [{ name: 'Home', path: '/' }];
  crumbs.push({ name: page.category === 'all' ? 'Nearby' : `${prettyCategory(page.category)} nearby`, path: page.category === 'all' ? '/nearby' : `/nearby/${page.category}` });
  if (page.city) crumbs.push({ name: page.areaLabel || page.city, path: page.path });
  const crumbTrail = crumbs.map((c, i) => (i === crumbs.length - 1
    ? `<span aria-current="page">${escapeHtml(c.name)}</span>`
    : `<a href="${c.path}">${escapeHtml(c.name)}</a>`)).join(' &rsaquo; ');
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${origin}${c.path}` })),
  };

  const faqItems = [
    {
      q: `How does Try1Second find ${catLabel} near ${label}?`,
      a: `We query live map and places data around the coordinates of ${label} and list each ${noun.one} closest first, with its address and distance. Rows carry a rating or a price only when the partner feed actually supplies one; an open-map row carries name, address and distance only.`,
    },
    {
      q: `Can I book ${catLabel} on Try1Second?`,
      a: `No. Try1Second is a comparison and discovery site, so "Book / website" and "Get directions" hand you to the partner's own page, and every click goes through our tracked exit so we can see which listings are useful.`,
    },
    {
      q: `Why is there no rating on some cards?`,
      a: `Because no source published one for that ${noun.one}. We would rather show an honest blank than an invented rating, review count or price.`,
    },
  ];
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
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
  const ogImage = `${origin}/feature-graphic.png`;
  const faqHtml = faqItems.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`).join('');

  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${origin}${page.path}">
${indexable ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex, follow">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Try1Second">
<meta property="og:title" content="${escapeHtml(h1)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${origin}${page.path}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(h1)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${ogImage}">
<style>${NEARBY_CSS}</style>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(faq)}</script>
${itemList ? `<script type="application/ld+json">${JSON.stringify(itemList)}</script>` : ''}
</head><body><header><a href="/">Try1Second</a><nav><a href="/nearby">Nearby</a>${NEARBY_CATEGORIES.map((c) => `<a href="/nearby/${c}">${prettyCategory(c)}</a>`).join('')}</nav></header>
<main><nav class="crumbs" aria-label="Breadcrumb">${crumbTrail}</nav>
<h1>${escapeHtml(h1)}</h1>
<p class="lead">${rows.length
    ? `${rows.length} ${catLabel} around ${escapeHtml(placeOf)}, closest first. Every card says where its data came from, and every partner click goes through our own tracked exit.`
    : `Places around ${escapeHtml(placeOf)}, closest first. Every card says where its data came from.`}</p>
${list}
${notes ? `<section class="notes"><h2>Data notes</h2><ul>${notes}</ul></section>` : ''}
${page.city && !page.areaLabel ? relatedLinks(page) : ''}
<section class="faq"><h2>Questions about ${escapeHtml(catLabel)} near ${escapeHtml(label)}</h2>${faqHtml}
<p>Names, addresses and distances come from open map data. Ratings, review counts and price levels appear only when a partner feed actually supplies them, so we never invent a rating, a review count or a price.</p></section>
</main>
<footer><p><a href="/answers">All comparisons</a> &middot; <a href="/">Search prices</a> &middot; <a href="/about">About</a></p></footer></body></html>`;
}
