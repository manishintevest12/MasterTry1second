/**
 * Grocery worker (India). A grocery search runs ONLY this worker.
 * Real product prices for grocery queries from Amazon.in and Flipkart grocery
 * listings (same SSR markup as the ecommerce worker, grocery-scoped queries).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { parseBlinkit } from '../parsers/blinkit';
import { ZEP_API_BASE, zeptoAppHeaders, zeptoStoreId, parseZeptoSearch } from '../parsers/zeptoSearch';
import { parseBigbasket } from '../parsers/bigbasket';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

// City coordinates for quick-commerce APIs (BlinkIt/Zepto/etc. price by delivery zone).
const GCITY_COORDS: Record<string, [number, number]> = {
  'new delhi': [28.6315, 77.2167], delhi: [28.6315, 77.2167], noida: [28.5355, 77.391],
  gurgaon: [28.4595, 77.0266], gurugram: [28.4595, 77.0266], bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777], pune: [18.5204, 73.8567], hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707], kolkata: [22.5726, 88.3639], ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462], indore: [22.7196, 75.8577],
  chandigarh: [30.7333, 76.7794], kochi: [9.9312, 76.2673],
  // Nagpur: city-center coords 21.1458/79.0882 return "location not serviceable" on the
  // api3.blinkit.com app gateway; 21.1582/79.0928 verified live (15 milk offers, 17 Oct).
  nagpur: [21.1582, 79.0928],
  // Verified live on the Blinkit app gateway 17 Oct (milk: Bhopal 19, Surat 19, Patna 13,
  // Coimbatore 19, Guwahati 13 offers).
  bhopal: [23.2599, 77.4126], surat: [21.1702, 72.8311], patna: [25.5941, 85.1376],
  coimbatore: [11.0168, 76.9558], guwahati: [26.1445, 91.7362],
};

const q = (ctx: { query: any }) =>
  String(ctx.query.entityName || ctx.query.rawQuery || '')
    .replace(/\b(grocery|quick|10 min|instant|order|buy)\b/gi, ' ').replace(/\s+/g, ' ').trim();

const QUICK_FAILS: Array<{ sourceId: string; url: (t: string) => string; probe: string; note: string }> = [
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

/** Extract (layoutId, endpoint) pairs from home deeplinks + raw layoutId JSON fields. */
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
  // Extra grids referenced only as raw layoutId JSON fields (category grids inside
  // campaign/layout responses); layout/v2 is a cheap 200/404 probe for them.
  for (const m of body.matchAll(/layoutId[\\":\s]+(\d{4,8})/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ id: m[1], endpoint: 'layout/v2' });
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
      // Zepto (owner request 17 Oct). Recon: zeptonow.com -> zepto.com web is AWS-WAF cookie-challenged
      // on EVERY endpoint (bff-gateway 202 even from a real browser without the challenge cookie) and web
      // search is login-gated; the mobile app's Kong gateway route POST /api/v3/search EXISTS (429 = WAF,
      // 404 = no-route — verified). This worker attempts it with APK-extracted app headers; the WAF's
      // acceptance is IP-dependent (sandbox 429s — Hostinger retest pending). Honest fail otherwise.
      sourceId: 'w_grocery_zepto',
      name: 'Grocery worker: Zepto app search (api-gateway v3/search, APK-extracted)',
      priority: 14,
      timeoutMs: 30_000,
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
        // 1. Serviceability (known-ungated): proves the location is served + gives the store UUID.
        let storeId: string | null = null;
        try {
          const svcUrl = `${ZEP_API_BASE}/serviceability-service/api/v1/serviceability?lat=${lat}&long=${lng}`;
          const svc = await cffiFetch(svcUrl, { impersonate: 'chrome', timeoutMs: 15_000, headers: zeptoAppHeaders() });
          if (svc.status === 200 && svc.body) storeId = zeptoStoreId(svc.body);
        } catch { /* store id is optional context for the search call */ }
        // 2. App search route (WAF-dependent).
        const body = JSON.stringify({ query: term, latitude: lat, longitude: lng, ...(storeId ? { store_id: storeId } : {}), page: 0, page_size: 30 });
        const r = await cffiFetch(`${ZEP_API_BASE}/api/v3/search`, { impersonate: 'chrome', method: 'POST', body, timeoutMs: 22_000, headers: zeptoAppHeaders() });
        if (r.status === 429) throw new AcquisitionError('ACCESS_CHALLENGE', `Zepto search WAF 429 from this IP (${ZEP_API_BASE}/api/v3/search exists but the WAF rejects this IP; Hostinger retest pending)`);
        if (r.status === 404) throw new AcquisitionError('NOT_FOUND', 'Zepto v3/search route not found on the Kong gateway (no route matched)');
        if (r.status === 400) throw new AcquisitionError('MALFORMED_RESPONSE', `Zepto search rejected the request body: ${(r.body || '').slice(0, 160)}`);
        if (r.status !== 200 || !r.body) throw new AcquisitionError('SERVER_ERROR', `Zepto search HTTP ${r.status}: ${(r.body || '').slice(0, 160)}`);
        const items = parseZeptoSearch(r.body, ctx.source, term, cityLabel, 16);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `Zepto returned no products for "${term}" at ${cityLabel} (200, body ${(r.body || '').slice(0, 120)})`);
        return items;
      },
    },
    {
      // Blinkit LIVE: /v1/layout/search answers real JSON to browserless HTTP when sent with the
      // web-app headers (app_client=consumer_web + lat/lon). Server-side search, location-aware prices.
      sourceId: 'w_grocery_blinkit',
      name: 'Grocery worker: Blinkit search API (app gateway + web fallback)',
      priority: 14,
      timeoutMs: 30_000,
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
        // PRIMARY (17 Oct, APK-extracted XAPK v17.65 via APKFab): the Android app's Kong gateway
        // api3.blinkit.com (config/domains rollout target for api2.grofers.com) is NOT behind the
        // website's Cloudflare edge. POST /v1/layout/search with app headers (lat/lon + Grofers UA)
        // returns the SAME product_card_snippet_type_2 widgets as the web endpoint — verified live
        // from the sandbox datacenter IP where blinkit.com 403s. No auth, no cookies.
        const appUrl = `https://api3.blinkit.com/v1/layout/search?q=${encodeURIComponent(term)}&search_type=type_to_search`;
        const appHeaders: Record<string, string> = {
          lat: String(lat),
          lon: String(lng),
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Grofers/17.65.0 (Android 13; com.grofers.customerapp)',
          platform: 'android',
          app_version: '17.65.0',
        };
        let r: { status: number; body: string } = { status: 0, body: '' };
        let usedAppGateway = false;
        try {
          r = await cffiFetch(appUrl, { impersonate: 'chrome', method: 'POST', body: '{}', timeoutMs: 22_000, headers: appHeaders });
          if (r.status === 200 && r.body) usedAppGateway = true;
        } catch { /* fall through to the web endpoint */ }
        const url = `https://blinkit.com/v1/layout/search?q=${encodeURIComponent(term)}&search_type=type_to_search`;
        // Some egress IPs (shared hosting) get a 403 on the first fingerprint; a second
        // TLS profile often passes. Honest-fail only after both attempts.
        const blHeaders: Record<string, string> = {
          app_client: 'consumer_web',
          lat: String(lat),
          lon: String(lng),
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: 'https://blinkit.com',
          Referer: `https://blinkit.com/s/?q=${encodeURIComponent(term)}`,
        };
        if (!usedAppGateway) {
          for (const profile of ['chrome', 'safari17_0', 'chrome110']) {
            r = await cffiFetch(url, { impersonate: profile, method: 'POST', body: '{}', timeoutMs: 22_000, headers: blHeaders });
            if (r.status === 200 && r.body) break;
            // Cloudflare samples per-request: a short cooldown between TLS profiles
            // materially raises the odds the next profile passes.
            if (r.status === 403 || r.status === 429) await new Promise((res) => setTimeout(res, 1500));
          }
        }
        if (!usedAppGateway && (r.status === 403 || r.status === 202)) throw new AcquisitionError('ACCESS_CHALLENGE', `Blinkit search API HTTP ${r.status} (app gateway + 3 TLS web fingerprints all blocked)`);
        if (r.status !== 200 || !r.body) throw new AcquisitionError('SERVER_ERROR', `Blinkit search API HTTP ${r.status}`, r.status);
        const items = parseBlinkit(r.body, ctx.source, url, cityLabel, 16);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `Blinkit returned no products for "${term}" at ${cityLabel} (not serviceable or no match)`);
        return items;
      },
    },
    {
      // BigBasket LIVE: listing-svc answers real JSON once the session carries location cookies.
      // Handshake (3 calls, same cookie jar): homepage -> serviceable(lat,lng) -> listing-svc.
      sourceId: 'w_grocery_bigbasket',
      name: 'Grocery worker: BigBasket listing API',
      priority: 13,
      timeoutMs: 60_000,
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
        const BB = 'https://www.bigbasket.com';
        const baseHeaders = {
          Accept: 'application/json',
          'x-channel': 'BB-WEB',
          'x-entry-context': 'bb-b2c',
          'x-entry-context-id': '100',
          Origin: BB,
          Referer: `${BB}/ps/?q=${encodeURIComponent(term)}`,
        };
        // Step 1: homepage -> session cookies (Akamai bm_* + _bb_*)
        const home = await cffiFetch(`${BB}/`, { impersonate: 'chrome', timeoutMs: 20_000, returnCookies: true });
        if (home.status !== 200 || !home.cookies) throw new AcquisitionError('ACCESS_CHALLENGE', `BigBasket homepage HTTP ${home.status}`);
        // Step 2: serviceable lookup -> real place info for lat/lng
        const svUrl = `${BB}/ui-svc/v1/serviceable/?lat=${lat}&lng=${lng}&send_all_serviceability=true`;
        const sv = await cffiFetch(svUrl, { impersonate: 'chrome', headers: baseHeaders, timeoutMs: 15_000, cookies: home.cookies, returnCookies: true });
        let pi: any = {};
        try { pi = JSON.parse(sv.body).places_info || {}; } catch { /* fall through with raw coords */ }
        const area = String(pi.area || cityLabel);
        const pincode = String(pi.pincode || '');
        // Step 3: set the location cookies the web app sets, then fetch the listing.
        const addrCookie = `${pi.lat ?? lat}_${pi.lng ?? lng}_${area}_${pincode}_1_false_true_true_Express`;
        const listingUrl = `${BB}/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(term)}&page=1`;
        const r = await cffiFetch(listingUrl, {
          impersonate: 'chrome',
          timeoutMs: 25_000,
          headers: { ...baseHeaders, 'x-latitude': String(pi.lat ?? lat), 'x-longitude': String(pi.lng ?? lng) },
          cookies: { ...sv.cookies, _bb_addressinfo: addrCookie, _bb_pin_code: pincode, _bb_lat_long: Buffer.from(`${lat}|${lng}`).toString('base64') },
        });
        if (r.status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', `BigBasket listing API HTTP 403 (Akamai)`);
        if (r.status === 400) throw new AcquisitionError('EMPTY_RESPONSE', `BigBasket listing API rejected the location handshake (HTTP 400)`);
        if (r.status !== 200 || !r.body) throw new AcquisitionError('SERVER_ERROR', `BigBasket listing API HTTP ${r.status}`, r.status);
        const items = parseBigbasket(r.body, ctx.source, listingUrl, cityLabel, 16);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `BigBasket returned no products for "${term}" at ${cityLabel}`);
        return items;
      },
    },
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
        // The home page embeds product cards (ItemCollectionCard) directly; collect them too.
        try {
          collectImProducts(JSON.parse(home.body), products);
        } catch {
          /* home body not JSON-parseable; grids below still carry products */
        }

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
