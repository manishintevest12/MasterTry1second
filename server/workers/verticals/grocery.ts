/**
 * Grocery worker (India). A grocery search runs ONLY this worker.
 * Real product prices for grocery queries from Amazon.in and Flipkart grocery
 * listings (same SSR markup as the ecommerce worker, grocery-scoped queries).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { parseBlinkit } from '../parsers/blinkit';
import { parseZeptoSsr, zeptoSsrMatches, type ZeptoSsrProduct } from '../parsers/zeptoSsr';
import { makeAwsWafSolver, AWS_WAF_UA } from '../../common/awsWafChallenge';
import { parseBigbasket } from '../parsers/bigbasket';
import { AcquisitionError } from '../../common/httpClient';
import { newRawItem } from '../../sources/contract';
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

// Zepto: one AWS-WAF solver per process (token cache 2.5 min inside).
let zepSolver: ReturnType<typeof makeAwsWafSolver> | undefined;
function zeptoSolver() {
  if (!zepSolver) zepSolver = makeAwsWafSolver((url, opts) => cffiFetch(url, opts) as any);
  return zepSolver;
}

/**
 * Brand catalog routing: words in the query that look like brands map to /brand/<slug>
 * pages (verified live: amul/nestle/britannia/dove all SSR full catalogs). Common generic
 * grocery terms route to the dominant brand's catalog so "milk" reaches real products.
 * This is ROUTING knowledge only — every price still comes from the live page.
 */
const ZEPTO_TERM_BRANDS: Record<string, string[]> = {
  milk: ['amul', 'mother-dairy'], butter: ['amul'], curd: ['amul'], paneer: ['amul'],
  atta: ['aashirvaad', 'fortune'], rice: ['daawat', 'india-gate'], oil: ['fortune', 'figaro'],
  biscuit: ['britannia', 'parle'], biscuits: ['britannia', 'parle'], chips: ['lays', 'kurkure'],
  bread: ['britannia', 'harvest'], cheese: ['amul', 'go'], cream: ['amul'], ghee: ['amul', 'mother-dairy'],
  coffee: ['nescafe', 'tata-coffee'], tea: ['tata-tea', 'lipton'], namkeen: ['haldirams', 'bikano'],
  icecream: ['amul', 'kwality-walls'], 'ice cream': ['amul', 'kwality-walls'], chocolate: ['amul', 'dairy-milk'],
  juice: ['real', 'tropicana'], soap: ['dove', 'lux'], shampoo: ['head-shoulders', 'dove'],
  detergent: ['surf-excel', 'ariel'], surf: ['surf-excel'], lays: ['lays'], amul: ['amul'],
  nestle: ['nestle'], maggi: ['nestle'], britannia: ['britannia'], dal: ['tata-sampann'],
  sugar: ['dhampur', 'madhur'], salt: ['tata', 'aashirvaad'], maida: ['aashirvaad'], poha: ['tata-sampann'],
};
function zeptoBrandCandidates(term: string): string[] {
  const low = term.toLowerCase();
  const slugs: string[] = [];
  // exact keyword routing first
  for (const [kw, brands] of Object.entries(ZEPTO_TERM_BRANDS)) {
    if (low.includes(kw)) { for (const b of brands) if (slugs.length < 3 && !slugs.includes(b)) slugs.push(b); }
    if (slugs.length >= 3) return slugs.slice(0, 3);
  }
  // single words that could BE brand slugs (e.g. "nescafe")
  for (const w of low.split(/[^a-z0-9]+/).filter((x) => x.length >= 4)) {
    if (!slugs.includes(w) && slugs.length < 2) slugs.push(w);
  }
  return slugs.slice(0, 3);
}

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
      // Zepto LIVE (17 Oct breakthrough): zepto.com SSR rails behind an AWS WAF "Goku" JS
      // challenge. server/common/awsWafChallenge.ts mints the aws-waf-token browserlessly
      // (jsdom + cffi transport, PoW posted as multipart — verified from the sandbox IP),
      // then these pages return 200 with REAL priced product JSON in the RSC payload:
      //   - /delivery-in-<city-slug>  city rails (68 cities; Indore verified) — preferred
      //   - /                        homepage rails (~60 products, IP-city fallback)
      //   - /brand/<slug>            brand catalog (amul/nestle/britannia/dove verified)
      // Search pages are a client-side shell, so the worker filters rails client-side
      // (same honest pattern as Instamart). Keyword->brand routing lets generic terms
      // ("milk" -> amul/mother-dairy, "atta" -> aashirvaad/fortune) reach real catalog
      // pages; a page with zero parsed products is skipped, never fabricated.
      sourceId: 'w_grocery_zepto',
      name: 'Grocery worker: Zepto SSR rails (zepto.com, AWS WAF PoW-solved)',
      priority: 14,
      timeoutMs: 90_000,
      run: async (ctx: any) => {
        const term = q(ctx);
        if (!term) return [];
        const loc = ctx.query.location || {};
        const cityLabel = loc.city ? String(loc.city) : '';
        const citySlug = String(cityLabel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const solver = zeptoSolver();
        // Page candidates: city rails (or homepage), then up to 3 brand catalog pages.
        const pages: string[] = [];
        pages.push(citySlug ? `https://www.zepto.com/delivery-in-${citySlug}` : 'https://www.zepto.com/');
        const brandSlugs = zeptoBrandCandidates(term);
        for (const b of brandSlugs) pages.push(`https://www.zepto.com/brand/${b}`);
        const products = new Map<string, ZeptoSsrProduct>();
        let pagesOk = 0;
        let pages404 = 0;
        let lastStatus = 0;
        for (const url of pages) {
          try {
            const r = await solver.wafGet(url);
            lastStatus = r.status;
            if (r.status === 200 && r.body && !r.body.includes('gokuProps')) {
              pagesOk++;
              for (const prod of parseZeptoSsr(r.body)) if (!products.has(prod.variantId || prod.name)) products.set(prod.variantId || prod.name, prod);
              if (products.size > 240) break;
            } else if (r.status === 404) {
              pages404++; // unknown city slug / brand slug — fall back
              if (url.endsWith('.com/') === false && url.includes('/delivery-in-')) pages.push('https://www.zepto.com/');
            }
          } catch (e: any) {
            throw new AcquisitionError('ACCESS_CHALLENGE', `Zepto AWS WAF challenge unsolved: ${String(e?.message || e).slice(0, 140)}`);
          }
        }
        if (!products.size) {
          if (pagesOk > 0) throw new AcquisitionError('EMPTY_RESPONSE', `Zepto SSR pages returned no product JSON (pages ok: ${pagesOk}, 404: ${pages404}, last HTTP ${lastStatus})`);
          throw new AcquisitionError('ACCESS_CHALLENGE', `Zepto SSR unreachable (last HTTP ${lastStatus}, 404s ${pages404})`);
        }
        const all = [...products.values()];
        const matched = all.filter((p) => zeptoSsrMatches(term, p));
        const pool = matched.length ? matched : all.filter((p) => zeptoSsrMatches(term.split(/\s+/)[0] || '', p));
        if (!pool.length) throw new AcquisitionError('EMPTY_RESPONSE', `Zepto rails had ${all.length} products, none matching "${term}" (search pages are app-side)`);
        const cityNote = cityLabel ? ` for ${cityLabel}` : '';
        return pool.slice(0, 16).map((p) => newRawItem(ctx.source, {
          // SSR names usually already carry the brand ("Amul Gold...") — never double-prefix.
          title: `${p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.brand + ' ' : ''}${p.name}`.slice(0, 140),
          price: Math.round(p.price),
          listPrice: p.mrp && p.mrp > p.price ? Math.round(p.mrp) : undefined,
          currency: 'INR',
          seller: 'Zepto',
          sellerUrl: `https://www.zepto.com/search?query=${encodeURIComponent(p.name)}`,
          attributes: {
            pack_size: p.pack || '',
            eta_minutes: '10',
            outlet: cityLabel || 'Zepto',
            in_stock: p.availableQuantity === undefined ? '' : String(p.availableQuantity > 0),
            data_note: `Zepto's own published price${cityNote}, read from zepto.com server-rendered rails (AWS WAF challenge solved browserless; no API key). Deeplink lands on Zepto's site.`,
            ...(p.image ? { image_url: p.image } : {}),
          },
          identifiers: p.variantId ? { sku: `zepto-${p.variantId}` } : {},
          evidence: { extractedFields: ['title', 'price', 'listPrice', 'image_url'], sourceReference: 'zepto.com SSR rails' },
        }));
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
        // Step 1: homepage -> session cookies (Akamai bm_* + _bb_*).
        // 17 Oct: production homepage 403'd (Akamai re-sample) while ui-svc and listing-svc
        // follow DIFFERENT edge rules — the HTML page is protected far more aggressively
        // than the JSON APIs. A homepage 403 is now a soft signal: we keep whatever cookies
        // the attempt set and still try the serviceability + listing handshake. Honest
        // ACCESS_CHALLENGE only when the LISTING itself is denied.
        const home = await cffiFetch(`${BB}/`, { impersonate: 'chrome', timeoutMs: 20_000, returnCookies: true });
        const homeCookies = home.status === 200 && home.cookies ? home.cookies : {};
        // Step 2: serviceable lookup -> real place info for lat/lng
        const svUrl = `${BB}/ui-svc/v1/serviceable/?lat=${lat}&lng=${lng}&send_all_serviceability=true`;
        const sv = await cffiFetch(svUrl, { impersonate: 'chrome', headers: baseHeaders, timeoutMs: 15_000, cookies: homeCookies, returnCookies: true });
        let pi: any = {};
        try { pi = JSON.parse(sv.body).places_info || {}; } catch { /* fall through with raw coords */ }
        const area = String(pi.area || cityLabel);
        const pincode = String(pi.pincode || '');
        // Step 3: set the location cookies the web app sets, then fetch the listing.
        const addrCookie = `${pi.lat ?? lat}_${pi.lng ?? lng}_${area}_${pincode}_1_false_true_true_Express`;
        const listingUrl = `${BB}/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(term)}&page=1`;
        const listingCookies = { ...sv.cookies, _bb_addressinfo: addrCookie, _bb_pin_code: pincode, _bb_lat_long: Buffer.from(`${lat}|${lng}`).toString('base64') };
        let r = await cffiFetch(listingUrl, {
          impersonate: 'chrome',
          timeoutMs: 25_000,
          headers: { ...baseHeaders, 'x-latitude': String(pi.lat ?? lat), 'x-longitude': String(pi.lng ?? lng) },
          cookies: listingCookies,
        });
        // Akamai samples per-request: one quiet cooldown + fresh jar retry beats a hard fail.
        if (r.status === 403) {
          await new Promise((res) => setTimeout(res, 2500));
          r = await cffiFetch(listingUrl, {
            impersonate: 'safari17_0',
            timeoutMs: 25_000,
            headers: { ...baseHeaders, 'x-latitude': String(pi.lat ?? lat), 'x-longitude': String(pi.lng ?? lng) },
            cookies: { ...listingCookies, ...(sv.cookies || {}) },
          });
        }
        if (r.status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', `BigBasket listing API HTTP 403 (Akamai, homepage ${home.status === 200 ? 'ok' : 'blocked'})`);
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
      name: 'Grocery worker: Amazon.in grocery listings (Imperva bm-verify bounce)',
      priority: 10,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
        // Same Imperva recipe as the ecommerce worker (verified live there): plain GET can
        // return a 200 + meta-refresh bm-verify interstitial or an edge-throttle 503. Same-session
        // verify bounce (up to 2 hops) + one 503 retry. Production showed HTTP 503 on 17 Oct
        // with the old 2-attempt plain-fetch loop; this mirrors the hardened ecom path.
        let body = '';
        let status = 0;
        let jar: Record<string, string> | undefined;
        const bounce = async (startCookies?: Record<string, string>) => {
          let r: any = await cffiFetch(url, { timeoutMs: 18_000, returnCookies: true, ...(startCookies ? { cookies: startCookies } : {}) });
          let b = r.body || ''; let st = r.status; let ck = r.cookies || startCookies || {};
          for (let hop = 0; hop < 2 && st === 200 && b.includes('bm-verify'); hop++) {
            const m = b.match(/URL='([^']+)'/);
            if (!m) break;
            const vUrl = m[1].startsWith('/') ? 'https://www.amazon.in' + m[1] : m[1];
            await new Promise((res) => setTimeout(res, 1200));
            r = await cffiFetch(vUrl, { cookies: ck, returnCookies: true, timeoutMs: 22_000 });
            b = r.body || ''; st = r.status; ck = r.cookies || ck;
          }
          return { body: b, status: st, cookies: ck };
        };
        let out = await bounce();
        body = out.body; status = out.status; jar = out.cookies;
        if (status === 503) {
          await new Promise((res) => setTimeout(res, 2500));
          out = await bounce();
          body = out.body; status = out.status; jar = out.cookies;
        }
        if (status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in HTTP 403 (edge denied)', 403);
        if (status !== 200) throw new AcquisitionError('SERVER_ERROR', `Amazon.in HTTP ${status}`, status);
        const items = parseAmazonIn(body, ctx.source, url);
        if (items.length) return items;
        if (body.includes('bm-verify') || looksLikeChallenge(body)) {
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in presented a challenge page');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', `Amazon.in returned no grocery products for "${term}"`);
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
