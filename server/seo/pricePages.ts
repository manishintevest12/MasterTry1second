/**
 * PRODUCT PRICE PAGES (owner 16 Nov: "make a system internally so that it increases traffic and unique
 * visitors exponentially").
 *
 * SEO does not compound from pages we write by hand, it compounds from a PAGE FAMILY that grows with the data
 * we already hold. Every hour this engine scans real offers (Blinkit, Zepto, Instamart, BigBasket, JioMart,
 * Amazon, Flipkart ...) and turns each product that at least two sellers price, in a city we know, into one
 * page: "<product> price in <city>". That is the highest-intent long tail in India ("amul taaza milk 1 l
 * price indore", "iphone 17 price in indore") and, unlike the old templated city pages, every one of these
 * pages carries data nobody else has: today's price at each store, who is cheapest, and when we checked.
 *
 * Three rules keep it honest, because 3,000 thin pages is exactly what got the site de-indexed:
 *   1. A page only exists when the DATA exists: 2+ sellers with a real price. No price, no page.
 *   2. A page is only indexable while it is fresh (<= 7 days). Stale pages stay reachable but go noindex.
 *   3. Nothing is invented. No rating, no "was" price, no availability guess. Where a field is unknown the
 *      page says so or omits it.
 *
 * Freshness is the flywheel: the catalogue worker refreshes prices, the page's "checked" stamp moves, the
 * sitemap lastmod moves, and Google recrawls a page that visibly changed.
 */
import { log } from '../common/logger';
import { getStore } from '../common/db';
import { INDIAN_CITIES } from './cityCorpus';

export type PriceOffer = {
  title: string;
  city: string;
  vendor: string;
  price: number;
  url: string | null;
  checkedAt: number;
  vertical: string;
};

export type PriceVendor = { vendor: string; price: number; url: string | null; checkedAt: number };

export type PriceEntry = {
  /** /price/<product>-in-<city> */
  path: string;
  product: string;
  productSlug: string;
  city: string;
  citySlug: string;
  vertical: string;
  vendors: PriceVendor[];
  low: number;
  high: number;
  checkedAt: number;
};

/** A page is worth indexing only while the prices on it are still credible. */
export const PRICE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** Two sellers minimum: one price is a listing, two prices are a comparison. */
export const MIN_VENDORS = 2;
const MAX_PAGES = 4000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/** Rupees, no decimals when whole, always the rupee sign: the format people search for. */
export function inr(n: number): string {
  const v = Math.round(Number(n) || 0);
  return `₹${v.toLocaleString('en-IN')}`;
}

/** The one place a product slug is built, so a URL can never disagree with its sitemap entry. */
export function pricePath(product: string, city: string): string {
  return `/price/${slugify(product)}-in-${slugify(city)}`;
}

/**
 * Pure: raw offers -> one entry per product+city that has MIN_VENDORS priced sellers.
 * Kept side-effect free so the grouping can be tested without a database.
 */
export function groupOffers(offers: PriceOffer[], now = Date.now()): PriceEntry[] {
  const cities = new Map<string, { name: string; slug: string }>();
  for (const c of INDIAN_CITIES) cities.set(c.name.trim().toLowerCase(), { name: c.name, slug: c.slug });

  const buckets = new Map<string, Map<string, PriceVendor> & { __meta?: any }>();
  const meta = new Map<string, { product: string; city: string; vertical: string }>();
  for (const o of offers) {
    const title = String(o.title || '').trim();
    const cityKey = String(o.city || '').trim().toLowerCase();
    const vendor = String(o.vendor || '').trim();
    const price = Number(o.price);
    if (!title || title.length < 4 || !cityKey || !vendor || !Number.isFinite(price) || price <= 0) continue;
    // Only cities the rest of the site already has pages for, so internal links always land somewhere.
    const city = cities.get(cityKey);
    if (!city) continue;
    const key = `${slugify(title)}|${city.slug}`;
    if (!buckets.has(key)) { buckets.set(key, new Map()); meta.set(key, { product: title, city: city.name, vertical: String(o.vertical || '') }); }
    const perCity = buckets.get(key)!;
    const prev = perCity.get(vendor.toLowerCase());
    // Cheapest price wins per vendor: a store quoting two prices for one product is one offer, the lower one.
    if (!prev || price < prev.price) {
      perCity.set(vendor.toLowerCase(), { vendor, price, url: o.url || null, checkedAt: Number(o.checkedAt) || now });
    }
  }

  const out: PriceEntry[] = [];
  for (const [key, perCity] of buckets) {
    if (perCity.size < MIN_VENDORS) continue;
    const m = meta.get(key)!;
    const vendors = [...perCity.values()].sort((a, b) => a.price - b.price);
    const low = vendors[0].price;
    const high = vendors[vendors.length - 1].price;
    const checked = Math.max(...vendors.map((v) => v.checkedAt));
    out.push({
      path: pricePath(m.product, m.city),
      product: m.product,
      productSlug: slugify(m.product),
      city: m.city,
      citySlug: slugify(m.city),
      vertical: m.vertical,
      vendors,
      low,
      high,
      checkedAt: checked,
    });
  }
  // Freshest and deepest comparisons first: those are the pages worth a crawler's time.
  return out.sort((a, b) => (b.vendors.length - a.vendors.length) || (b.checkedAt - a.checkedAt));
}

export function isPriceFresh(entry: PriceEntry, now = Date.now()): boolean {
  return now - entry.checkedAt <= PRICE_FRESH_MS;
}

let cache: { at: number; entries: PriceEntry[]; building: boolean } = { at: 0, entries: [], building: false };

async function fetchOffers(): Promise<PriceOffer[]> {
  const store = getStore();
  if (store.kind !== 'mysql') return []; // the dev file store has no offers table: no pages rather than fake ones
  const rows = await store.query<any>(
    `SELECT title, location_city AS city, COALESCE(vendor, seller) AS vendor, COALESCE(effective_price, mandatory_total) AS price,
            seller_url AS url, UNIX_TIMESTAMP(COALESCE(fetched_at, NOW())) * 1000 AS checkedAt, vertical
       FROM offers
      WHERE validation_status != 'INVALID'
        AND COALESCE(effective_price, mandatory_total) > 0
        AND location_city IS NOT NULL AND location_city <> ''
        AND title IS NOT NULL AND CHAR_LENGTH(title) >= 4
        AND COALESCE(vendor, seller) IS NOT NULL
        AND fetched_at > NOW() - INTERVAL 14 DAY
      ORDER BY fetched_at DESC
      LIMIT 40000`,
  );
  return (rows || []).map((r: any) => ({
    title: String(r.title || ''),
    city: String(r.city || ''),
    vendor: String(r.vendor || ''),
    price: Number(r.price) || 0,
    url: r.url ? String(r.url) : null,
    checkedAt: Number(r.checkedAt) || 0,
    vertical: String(r.vertical || ''),
  }));
}

/** Build (or reuse) the page index. Never throws: a broken catalogue means fewer pages, not a 500. */
export async function loadPriceIndex(): Promise<PriceEntry[]> {
  const now = Date.now();
  if (cache.entries.length && now - cache.at < CACHE_TTL_MS) return cache.entries;
  if (cache.building) return cache.entries;
  cache.building = true;
  try {
    const offers = await fetchOffers();
    const entries = groupOffers(offers, now).slice(0, MAX_PAGES);
    const grew = entries.length !== cache.entries.length;
    cache = { at: now, entries, building: false };
    log.info('Seo', `price pages built: ${entries.length} product x city comparisons from ${offers.length} offers`);
    // DISCOVERY LOOP (owner 16 Nov): a page nobody knows about earns nothing. New comparisons mean the sitemap
    // is stale, and a rebuilt sitemap is what makes IndexNow and the crawlers pick the new URLs up the same day
    // instead of whenever they next feel like it. Fire and forget: a failure here costs a delay, never a page.
    if (grew) {
      void (async () => {
        try {
          const mod: any = await import('./sitemap');
          if (typeof mod.rebuildSitemapNow === 'function') await mod.rebuildSitemapNow();
        } catch (e: any) {
          log.debug('Seo', 'sitemap rebuild after price growth failed', { error: String(e?.message || e).slice(0, 80) });
        }
      })();
    }
    return entries;
  } catch (e: any) {
    cache.building = false;
    log.warn('Seo', 'price page index failed (kept the previous one)', { error: String(e?.message || e).slice(0, 120) });
    return cache.entries;
  }
}

/** Synchronous view for the sitemap, which cannot await per-URL. Empty until the first build lands. */
export function pricePathsNow(): PriceEntry[] {
  const now = Date.now();
  return cache.entries.filter((e) => isPriceFresh(e, now));
}

export function findPriceEntry(path: string): PriceEntry | null {
  const p = path.replace(/\/+$/, '').toLowerCase();
  return pricePathsNow().find((e) => e.path === p) || null;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function asOf(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

/** The page. Unique title, honest numbers, real links, and structured data that quotes today's prices. */
export function renderPriceHtml(entry: PriceEntry, siblings: PriceEntry[], origin: string): string {
  const fresh = isPriceFresh(entry);
  const cheapest = entry.vendors[0];
  const dearest = entry.vendors[entry.vendors.length - 1];
  const save = entry.high - entry.low;
  const title = `${entry.product} price in ${entry.city} - ${inr(entry.low)} at ${cheapest.vendor}${entry.vendors[1] ? ` vs ${inr(entry.vendors[1].price)} at ${entry.vendors[1].vendor}` : ''}`;
  const desc = `${entry.product} price in ${entry.city} today: cheapest is ${inr(entry.low)} at ${cheapest.vendor}${save > 0 ? `, ${inr(save)} less than ${dearest.vendor} at ${inr(dearest.price)}` : ''}. Compared across ${entry.vendors.length} stores, checked ${asOf(entry.checkedAt)}.`;
  const canonical = `${origin}${entry.path}`;

  const rows = entry.vendors.map((v, i) => `
      <tr${i === 0 ? ' class="best"' : ''}>
        <td>${i === 0 ? '<span class="tag">Cheapest</span> ' : ''}${esc(v.vendor)}</td>
        <td class="num">${inr(v.price)}</td>
        <td>${v.url ? `<a href="${esc(v.url)}" rel="sponsored nofollow noopener" target="_blank">Go to store</a>` : '<span class="muted">no direct link</span>'}</td>
        <td class="muted">${asOf(v.checkedAt)}</td>
      </tr>`).join('');

  // Same product in other cities: the sibling pages that make this a cluster instead of an orphan.
  const otherCities = siblings.filter((s) => s.productSlug === entry.productSlug && s.citySlug !== entry.citySlug).slice(0, 8);
  // Other products in this city: keeps a visitor here instead of bouncing.
  const sameCity = siblings.filter((s) => s.citySlug === entry.citySlug && s.productSlug !== entry.productSlug).slice(0, 8);

  const faqs: Array<[string, string]> = [
    [`What is the price of ${entry.product} in ${entry.city} today?`,
      `${inr(entry.low)} at ${cheapest.vendor}${save > 0 ? `, the lowest of ${entry.vendors.length} stores we checked` : ''}. The same item is ${inr(entry.high)} at ${dearest.vendor}. Prices checked ${asOf(entry.checkedAt)}.`],
    [`Where is ${entry.product} cheapest in ${entry.city}?`,
      `${cheapest.vendor} shows ${inr(cheapest.price)}, which is ${save > 0 ? `${inr(save)} below the highest price we found` : 'the only price we could verify'}.`],
    ['How often are these prices updated?',
      `Our catalogue worker re-checks each store through the day. The stamp on this page shows when these numbers were last verified${fresh ? '' : ', and this page is due for a refresh'}.`],
  ];

  const faqHtml = faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Product', name: entry.product,
      offers: entry.vendors.map((v) => ({ '@type': 'Offer', price: v.price, priceCurrency: 'INR', seller: { '@type': 'Organization', name: v.vendor }, url: v.url || canonical, availability: 'https://schema.org/InStock' })),
    },
    { '@context': 'https://schema.org', '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: entry.low, highPrice: entry.high, offerCount: entry.vendors.length, areaServed: entry.city },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Price comparisons', item: `${origin}/price` },
      { '@type': 'ListItem', position: 3, name: `${entry.product} in ${entry.city}`, item: canonical },
    ] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ].map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n');

  const linkList = (items: PriceEntry[], label: string) => items.length
    ? `<h2>${esc(label)}</h2>\n<ul class="links">${items.map((s) => `<li><a href="${esc(s.path)}">${esc(s.product)} in ${esc(s.city)} - ${inr(s.low)}</a></li>`).join('')}</ul>`
    : '';

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Try1Second</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${fresh ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:url" content="${esc(canonical)}">
<style>
:root{--ink:#12161c;--mut:#5b6672;--line:#e3e8ee;--good:#0a7d3e;--bg:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 20px 56px}
nav.crumbs{font-size:13px;color:var(--mut);margin-bottom:14px}nav.crumbs a{color:var(--mut)}
h1{font-size:clamp(24px,4vw,34px);line-height:1.2;margin:0 0 10px}
h2{font-size:19px;margin:30px 0 10px}
.lede{font-size:17px;margin:0 0 8px}.lede b{color:var(--good)}
.stamp{font-size:13px;color:var(--mut);margin:0 0 18px}
table{width:100%;border-collapse:collapse;margin:10px 0 6px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);font-size:15px}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
tr.best td{background:#f3fbf6}.num{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.tag{display:inline-block;background:var(--good);color:#fff;font-size:11px;padding:1px 6px;border-radius:4px;vertical-align:1px}
.muted{color:var(--mut);font-size:13px}
a{color:#0b57d0}details{border-bottom:1px solid var(--line);padding:10px 0}summary{cursor:pointer;font-weight:600}
ul.links{list-style:none;padding:0;margin:0}ul.links li{padding:6px 0;border-bottom:1px solid var(--line);font-size:15px}
footer{margin-top:32px;font-size:12px;color:var(--mut)}
</style>
${ld}
</head>
<body>
<main>
<nav class="crumbs"><a href="/">Try1Second</a> / <a href="/price">Price comparisons</a> / ${esc(entry.product)} in ${esc(entry.city)}</nav>
<h1>${esc(entry.product)} price in ${esc(entry.city)}</h1>
<p class="lede">Cheapest today: <b>${inr(entry.low)}</b> at ${esc(cheapest.vendor)}${save > 0 ? `, ${inr(save)} less than ${esc(dearest.vendor)} at ${inr(dearest.price)}` : ''}. Compared across ${entry.vendors.length} stores.</p>
<p class="stamp">Prices last verified ${asOf(entry.checkedAt)} IST.${fresh ? '' : ' This comparison is due for a refresh and is not offered for indexing until it is.'}</p>
<table>
<thead><tr><th>Store</th><th>Price</th><th>Buy</th><th>Checked</th></tr></thead>
<tbody>${rows}
</tbody></table>
<p class="muted">Prices and stock change through the day; the store's own checkout is the price you pay. We do not add a markup or invent a discount.</p>
<h2>${esc(entry.product)} price in ${esc(entry.city)}: what the numbers mean</h2>
<p>The table lists every seller we could verify for ${esc(entry.product)} in ${esc(entry.city)}. The spread between the cheapest and the dearest of them is ${inr(save)}${save > 0 ? `, about ${Math.round((save / entry.high) * 100)}% of the highest price` : ''}. Delivery fees, surge and membership offers are applied at the store's checkout, so the best total can differ from the best sticker price when your basket is small.</p>
${faqHtml}
${linkList(otherCities, `${esc(entry.product)} in other cities`)}
${linkList(sameCity, `Other price comparisons in ${esc(entry.city)}`)}
<h2>How Try1Second compares prices</h2>
<p>We scan the storefront pages of India's marketplaces and quick-commerce apps through the day, keep the price each one shows, and publish the comparison with the time it was checked. When a store shows nothing we can verify, it is left out rather than filled with a guess. <a href="/ecommerce">See every store we scan</a>.</p>
<footer>Try1Second - independent price comparison, no markup. This page is not sponsored; links to stores may earn a commission at no extra cost to you.</footer>
</main>
</body>
</html>`;
}

/**
 * The hub: /price. A crawl-depth shortcut (every product page is one click from here) and a landing page for
 * "price comparison india". Three columns of real comparisons, grouped by vertical, nothing invented.
 */
export function renderPriceIndexHtml(entries: PriceEntry[], origin: string): string {
  const fresh = entries.filter((e) => isPriceFresh(e));
  const byVertical = new Map<string, PriceEntry[]>();
  for (const e of fresh) {
    const k = e.vertical || 'ecommerce';
    if (!byVertical.has(k)) byVertical.set(k, []);
    byVertical.get(k)!.push(e);
  }
  const sections = [...byVertical.entries()].sort((a, b) => b[1].length - a[1].length).map(([vertical, list]) => {
    const top = list.slice(0, 40);
    return `<h2>${esc(vertical)} - ${list.length} verified comparisons</h2>
<ul class="links">${top.map((e) => `<li><a href="${esc(e.path)}">${esc(e.product)} in ${esc(e.city)} - ${inr(e.low)}</a> <span class="muted">${e.vendors.length} stores</span></li>`).join('')}</ul>`;
  }).join('\n');
  const title = `Product price comparison - ${fresh.length} live comparisons across India`;
  const desc = `Today's verified prices for everyday products and gadgets in ${new Set(fresh.map((e) => e.city)).size} Indian cities, compared across the stores that sell them. Cheapest seller first, with the time we checked.`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Try1Second</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${fresh.length >= 20 ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">
<link rel="canonical" href="${esc(origin)}/price">
<style>
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#12161c}
main{max-width:860px;margin:0 auto;padding:24px 20px 56px}h1{font-size:clamp(24px,4vw,34px);margin:0 0 10px}
h2{font-size:19px;margin:28px 0 8px;text-transform:capitalize}.lede{color:#5b6672}
ul.links{list-style:none;padding:0;margin:0}ul.links li{padding:7px 0;border-bottom:1px solid #e3e8ee}
a{color:#0b57d0}.muted{color:#5b6672;font-size:13px}
</style>
</head>
<body><main>
<h1>Product price comparison in India</h1>
<p class="lede">${esc(desc)}</p>
${sections || '<p class="lede">Our catalogue is still filling. Comparisons appear here as soon as two stores show a verified price for the same product in the same city.</p>'}
<p class="muted">Prices are checked through the day and stamped per page. No markup, no invented discounts.</p>
</main></body></html>`;
}
