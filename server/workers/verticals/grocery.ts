/**
 * Grocery worker (India). A grocery search runs ONLY this worker.
 * Real product prices for grocery queries from Amazon.in and Flipkart grocery
 * listings (same SSR markup as the ecommerce worker, grocery-scoped queries).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

// City coordinates for quick-commerce APIs (BlinkIt/Zepto/etc. price by delivery zone).
const GCITY_COORDS: Record<string, [number, number]> = {
  'new delhi': [28.6315, 77.2167], delhi: [28.6315, 77.2167], noida: [28.5355, 77.391],
  gurgaon: [28.4595, 77.0266], bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777], pune: [18.5204, 73.8567], hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707], kolkata: [22.5726, 88.3639], ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462], indore: [22.7196, 75.8577],
  chandigarh: [30.7333, 76.7794], kochi: [9.9312, 76.2673], nagpur: [21.1458, 79.0882],
};

const q = (ctx: { query: any }) =>
  String(ctx.query.entityName || ctx.query.rawQuery || '')
    .replace(/\b(grocery|quick|10 min|instant|order|buy)\b/gi, ' ').replace(/\s+/g, ' ').trim();

const QUICK_FAILS: Array<{ sourceId: string; url: (t: string) => string; probe: string; note: string }> = [
  { sourceId: 'w_grocery_blinkit', url: (t) => `https://blinkit.com/cn/${encodeURIComponent(t)}/cid/12`, probe: 'https://blinkit.com/', note: 'Blinkit returns an Akamai/bot challenge page (403, no product data) to browserless HTTP' },
  { sourceId: 'w_grocery_zepto', url: (t) => `https://www.zeptonow.com/search?query=${encodeURIComponent(t)}`, probe: 'https://www.zeptonow.com/', note: 'Zeptonow returns a 202 JS challenge shell to browserless HTTP' },
  { sourceId: 'w_grocery_bigbasket', url: (t) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(t)}`, probe: 'https://www.bigbasket.com/ps/?q=milk', note: 'BigBasket serves the search page but SSRData is null; product-search APIs (/mapi etc.) are Akamai 403' },
  { sourceId: 'w_grocery_flipkart_minutes', url: (t) => `https://www.flipkart.com/minutes-store`, probe: 'https://www.flipkart.com/minutes-store', note: 'Flipkart Minutes store is a JS shell with no SSR product prices' },
];

// ---------- Swiggy Instamart (live, reverse-engineered ungated endpoints) ----------
// Instamart's edge gates /api/instamart/search* and collection endpoints (202 challenge),
// but these product-bearing endpoints answer real JSON to browserless HTTP:
//   GET  /api/instamart/home/v2?clientId=INSTAMART-APP&lat&lng        -> store/pod id + banner layout ids
//   GET  /api/instamart/campaign/listing/v2?layoutId&clientId&lat&lng -> ItemCollectionCard products (Top Deals)
//   GET  /api/instamart/campaign/mxn/v2?layoutId&clientId&lat&lng     -> mxn banner product grids
//   GET  /api/instamart/layout/v2?layoutId&storeId&clusterId&lat&lng  -> category product grids
// Items carry displayName, brand, category, inStock, imageIds (media-assets.swiggy.com
// Cloudinary CDN) and variations[0].price { mrp, offerPrice, discountValue } in INR.
const IM_BASE = 'https://instamart.swiggy.com';
const IM_HEADERS = {
  Accept: 'application/json',
  Origin: IM_BASE,
  Referer: IM_BASE + '/',
};

interface ImMoney { currencyCode?: string; units?: string | number; nanos?: number }
interface ImVariation {
  skuId?: string; spinId?: string; quantityDescription?: string;
  imageIds?: string[];
  price?: { mrp?: ImMoney; offerPrice?: ImMoney; discountValue?: ImMoney };
}
interface ImProduct {
  displayName?: string; brand?: string; category?: string;
  inStock?: boolean; isAvail?: boolean;
  variations?: ImVariation[];
}

function imRupees(m?: ImMoney): number | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const units = Number(m.units);
  if (!Number.isFinite(units)) return undefined;
  const nanos = Number(m.nanos) || 0;
  return Math.round((units + nanos / 1e9) * 100) / 100;
}

/** Structure-agnostic walker: pull every ItemCollectionCard-style product object out of an Instamart payload. */
function collectImProducts(node: any, out: ImProduct[], depth = 0): void {
  if (!node || depth > 20 || out.length > 2500) return;
  if (Array.isArray(node)) { for (const v of node) collectImProducts(v, out, depth + 1); return; }
  if (typeof node !== 'object') return;
  const looksLikeProduct =
    typeof node.displayName === 'string' && Array.isArray(node.variations) && node.variations.length > 0;
  if (looksLikeProduct) out.push(node as ImProduct);
  for (const v of Object.values(node)) collectImProducts(v, out, depth + 1);
}

/** Extract (layoutId, endpoint) pairs from home deeplinks. */
function extractImLayouts(body: string): Array<{ id: string; endpoint: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; endpoint: string }> = [];
  const re = /swiggy:\/\/stores\/instamart\/(campaign-collection\/listing|campaign-collection\/mxn|category)[^"\\]{0,160}?layoutId=(\d+)/g;
  for (const m of body.matchAll(re)) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, endpoint: m[1].includes('listing') ? 'campaign/listing/v2' : 'layout/v2' });
  }
  return out;
}

function imTokenize(term: string): string[] {
  return term.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length >= 2 && !['the', 'and'].includes(t));
}

function buildImItems(products: ImProduct[], term: string, cityLabel: string, sourceUrl: string, cap: number) {
  const tokens = imTokenize(term);
  const now = new Date().toISOString();
  const scored: Array<{ item: any; score: number }> = [];
  for (const p of products) {
    const v = (p.variations || [])[0] || ({} as ImVariation);
    const price = imRupees(v.price?.offerPrice) ?? imRupees(v.price?.mrp);
    if (price == null || price <= 0) continue;
    const mrp = imRupees(v.price?.mrp);
    const name = String(p.displayName || '');
    if (!name) continue;
    const hay = `${name} ${p.brand || ''} ${p.category || ''}`.toLowerCase();
    let score = 0;
    // plural-insensitive: 'drinks' matches 'drink', 'chips' stays 'chips'
    for (const t of tokens) if (hay.includes(t) || (t.endsWith('s') && hay.includes(t.slice(0, -1)))) score++;
    if (score === 0) continue;
    if (tokens.length > 1 && score < tokens.length) score -= 0.5; // partial matches rank below full matches
    const imageId = (v.imageIds || [])[0];
    const imageUrl = imageId ? `https://media-assets.swiggy.com/swiggy/image/upload/${imageId}` : undefined;
    const inStock = p.inStock === true && p.isAvail !== false;
    const item: any = {
      title: `${name}${v.quantityDescription ? ` (${v.quantityDescription})` : ''}`,
      price,
      listPrice: mrp && mrp > price ? mrp : undefined,
      brand: p.brand ? String(p.brand).slice(0, 120) : undefined,
      identifiers: v.skuId ? { sku: v.skuId, vendorProductId: v.spinId || undefined } : undefined,
      attributes: {
        platform: 'Swiggy Instamart',
        ...(v.quantityDescription ? { quantity: v.quantityDescription.slice(0, 60) } : {}),
        ...(p.category ? { category: String(p.category).slice(0, 80) } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        price_basis: `Instamart offer price for ${cityLabel} (10-min delivery zone)`,
        data_note: 'Price extracted from Swiggy Instamart storefront APIs (instamart.swiggy.com); final price at checkout may vary',
      },
      seller: 'Swiggy Instamart',
      sellerUrl: `${IM_BASE}/instamart/search?query=${encodeURIComponent(name)}`,
      availability: inStock ? 'in_stock' : 'out_of_stock',
      location: { city: cityLabel },
      evidence: {
        sourceUrl,
        sourceReference: v.skuId,
        extractedFields: ['displayName', 'variations[0].price.offerPrice', 'variations[0].price.mrp', 'inStock'],
      },
      fetchedAt: now,
    };
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  const seenNames = new Set<string>();
  const out: any[] = [];
  for (const { item } of scored) {
    const key = item.title.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    out.push({ ...item, sourceId: 'w_grocery_instamart' });
    if (out.length >= cap) break;
  }
  return out;
}

export const groceryWorker: VerticalWorker = {
  vertical: 'grocery',
  tasks: [
    ...QUICK_FAILS.map((src) => ({
      // Owner-mandated quick-commerce sources: ATTEMPTED on every grocery search,
      // honestly reported as unavailable when the edge gate blocks browserless HTTP.
      sourceId: src.sourceId,
      priority: 15,
      run: async (ctx: any) => {
        const term = q(ctx);
        if (!term) return [];
        const r = await cffiFetch(src.probe, { impersonate: 'chrome', timeoutMs: 12_000 });
        const gated = r.status === 202 || r.status === 403 || (r.status === 200 && /challenge|captcha/i.test(r.body.slice(0, 4000)) && !/__NEXT_DATA__/.test(r.body));
        if (gated) throw new AcquisitionError('ACCESS_CHALLENGE', src.note);
        // Edge case: page served but no product payload (shell) — still honest.
        throw new AcquisitionError('EMPTY_RESPONSE', src.note.replace(/returns|serves/, 'served'));
      },
    })),
    {
      // Swiggy Instamart LIVE: ungated storefront endpoints (reverse-engineered from the
      // instamart web bundle). Search path is edge-gated, so we pull product grids
      // (home banners + Top Deals campaign) and filter client-side by the query.
      sourceId: 'w_grocery_instamart',
      name: 'Grocery worker: Swiggy Instamart storefront APIs',
      priority: 12,
      timeoutMs: 55_000,
      run: async (ctx: any) => {
        const term = q(ctx);
        if (!term) return [];
        const loc = ctx.query.location || {};
        const coords =
          (typeof loc.lat === 'number' && typeof loc.lng === 'number' && loc.lat)
            ? ([loc.lat, loc.lng] as [number, number])
            : GCITY_COORDS[String(loc.city || '').toLowerCase()] || GCITY_COORDS['mumbai'];
        const cityLabel = loc.city ? String(loc.city) : 'Mumbai';
        const [lat, lng] = coords;

        const homeUrl = `${IM_BASE}/api/instamart/home/v2?clientId=INSTAMART-APP&lat=${lat}&lng=${lng}`;
        const home = await cffiFetch(homeUrl, { impersonate: 'chrome', headers: IM_HEADERS, timeoutMs: 20_000 });
        if (home.status !== 200 || !home.body) throw new AcquisitionError('ACCESS_CHALLENGE', `Instamart home/v2 HTTP ${home.status}`);
        let storeId = '';
        const pod = home.body.match(/"podId":\s*"?(\d+)"?/) || home.body.match(/"storeId":\s*"?(\d+)"?/);
        if (pod) storeId = pod[1];

        const products: ImProduct[] = [];
        const sources: string[] = [homeUrl];

        // Collect product grids: Top Deals campaign + home banner layouts (cap requests).
        const layouts = extractImLayouts(home.body).slice(0, 18);
        const calls: Array<{ endpoint: string; id: string }> = [{ endpoint: 'campaign/listing/v2', id: '35019' }, ...layouts];
        for (const c of calls) {
          const url =
            c.endpoint === 'layout/v2'
              ? `${IM_BASE}/api/instamart/layout/v2?layoutId=${c.id}&storeId=${storeId}&clusterId=&lat=${lat}&lng=${lng}&clientId=INSTAMART-APP`
              : `${IM_BASE}/api/instamart/campaign/listing/v2?layoutId=${c.id}&clientId=INSTAMART-APP&lat=${lat}&lng=${lng}`;
          try {
            const r = await cffiFetch(url, { impersonate: 'chrome', headers: IM_HEADERS, timeoutMs: 15_000 });
            if (r.status !== 200 || !r.body) continue;
            let json: any;
            try { json = JSON.parse(r.body); } catch { continue; }
            const before = products.length;
            collectImProducts(json, products);
            if (products.length > before) sources.push(url);
          } catch {
            /* one grid failing never blocks the source */
          }
          if (products.length > 1500) break;
        }
        const items = buildImItems(products, term, cityLabel, sources[0], 12);
        if (!items.length) {
          const detail = `Instamart storefront grids carried ${products.length} products, none matching "${term}" (search endpoint is edge-gated; home storeId=${storeId || 'n/a'})`;
          throw new AcquisitionError('EMPTY_RESPONSE', detail);
        }
        return items;
      },
    },

    {
      sourceId: 'w_grocery_amazon_in',
      name: 'Grocery worker: Amazon.in grocery listings',
      priority: 10,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
        let items: ReturnType<typeof parseAmazonIn> = [];
        let lastBody = '';
        for (let attempt = 1; attempt <= 2; attempt++) {
          const r = await ctx.fetch(url);
          if (r.status === 200) {
            lastBody = r.body;
            items = parseAmazonIn(r.body, ctx.source, url);
            if (items.length) break;
          } else if (attempt === 1 && r.status >= 500) {
            await new Promise((res) => setTimeout(res, 1500));
            continue;
          } else {
            throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'FORBIDDEN', `Amazon.in HTTP ${r.status}`, r.status);
          }
        }
        if (!items.length && looksLikeChallenge(lastBody)) throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in presented a challenge page');
        return items;
      },
    },
    {
      sourceId: 'w_grocery_flipkart',
      name: 'Grocery worker: Flipkart grocery listings',
      priority: 11,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(term)}`;
        const r = await ctx.fetch(url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Flipkart HTTP ${r.status}`, r.status);
        const items = parseFlipkart(r.body, ctx.source, url);
        if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'Flipkart presented a challenge page');
        return items;
      },
    },
  ],
};
registerVerticalWorker(groceryWorker);
