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
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem } from '../../types';

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
  { sourceId: 'w_grocery_instamart', url: (t) => `https://www.swiggy.com/instamart/search?str=${encodeURIComponent(t)}`, probe: 'https://www.swiggy.com/instamart', note: 'Swiggy Instamart web/app endpoints return 403/202 challenge to browserless HTTP (restaurant dapi works, instamart is separately gated)' },
  { sourceId: 'w_grocery_bigbasket', url: (t) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(t)}`, probe: 'https://www.bigbasket.com/ps/?q=milk', note: 'BigBasket serves the search page but SSRData is null; product-search APIs (/mapi etc.) are Akamai 403' },
  { sourceId: 'w_grocery_flipkart_minutes', url: (t) => `https://www.flipkart.com/minutes-store`, probe: 'https://www.flipkart.com/minutes-store', note: 'Flipkart Minutes store is a JS shell with no SSR product prices' },
];

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
      // Actowiz QuickCommerce API (api.quickcommerceapi.com, owner-sourced) — official
      // REST API for the six owner-mandated quick-commerce platforms that are edge-gated
      // to browserless HTTP. Key in QUICKCOMMERCE_API_KEY (hPanel env; owner supplies it).
      // Public API contract: GET /v1/search?q&lat&lon&platform  (X-API-Key header).
      sourceId: 'w_grocery_qcapi',
      name: 'Grocery worker: QuickCommerce API (BlinkIt, Zepto, Instamart, BigBasket, DMart, JioMart)',
      priority: 5,
      maxPerMinute: 12,
      timeoutMs: 60_000,
      run: async (ctx) => {
        const key = String(process.env.QUICKCOMMERCE_API_KEY || '').trim();
        if (!key) throw new AcquisitionError('EMPTY_RESPONSE', 'QuickCommerce API credentials not configured: set QUICKCOMMERCE_API_KEY in hPanel env (api.quickcommerceapi.com — BlinkIt/Zepto/Instamart/BigBasket/DMart/JioMart search; demo keys are rejected with 401 — the owner will supply the original key).');
        const term = q(ctx);
        if (!term) return [];
        const city = String(ctx.query.location?.city || '').toLowerCase().trim();
        const lat = Number(ctx.query.location?.lat) || (GCITY_COORDS[city] || GCITY_COORDS['new delhi'])[0];
        const lon = Number(ctx.query.location?.lng) || (GCITY_COORDS[city] || GCITY_COORDS['new delhi'])[1];
        const pincode = String(ctx.query.location?.pincode || '');
        const platforms: Array<[apiPlatform: string, seller: string, site: string]> = [
          ['BlinkIt', 'Blinkit', 'https://blinkit.com'],
          ['Zepto', 'Zepto', 'https://www.zeptonow.com'],
          ['Swiggy', 'Swiggy Instamart', 'https://www.swiggy.com/instamart'],
          ['BigBasket', 'BigBasket', 'https://www.bigbasket.com'],
          ['DMart', 'DMart', 'https://www.dmart.in'],
          ['JioMart', 'JioMart', 'https://www.jiomart.com'],
        ];
        const items: RawSourceItem[] = [];
        const errors: string[] = [];
        for (const [apiPlatform, seller, site] of platforms) {
          const url = `https://api.quickcommerceapi.com/v1/search?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lon}&platform=${apiPlatform}${pincode ? `&pincode=${pincode}` : ''}`;
          let r: Awaited<ReturnType<typeof cffiFetch>>;
          try {
            r = await cffiFetch(url, { timeoutMs: 9_000, headers: { 'X-API-Key': key, Accept: 'application/json' } });
          } catch { errors.push(`${apiPlatform}: fetch failed`); continue; }
          if (r.status === 401 || r.status === 403) {
            throw new AcquisitionError('FORBIDDEN', `QuickCommerce API rejected credentials (HTTP ${r.status}) — set a valid QUICKCOMMERCE_API_KEY`, r.status);
          }
          if (r.status !== 200) { errors.push(`${apiPlatform}: HTTP ${r.status}`); continue; }
          let j: any; try { j = JSON.parse(r.body); } catch { errors.push(`${apiPlatform}: non-JSON`); continue; }
          const rows: any[] = Array.isArray(j) ? j : (j?.items || j?.products || j?.results || j?.data?.items || j?.data || []);
          let emitted = 0;
          for (const it of rows) {
            if (emitted >= 8) break;
            const name = String(it?.name || it?.title || '').trim();
            const price = Math.round(Number(it?.price ?? it?.selling_price ?? it?.discounted_price ?? it?.display_price ?? NaN));
            if (!name || !Number.isFinite(price) || price <= 0) continue;
            const pack = String(it?.quantity || it?.pack_size || it?.packaging || '').trim();
            const img = typeof it?.image_url === 'string' ? it.image_url : (typeof it?.image === 'string' ? it.image : undefined);
            const link = typeof it?.url === 'string' ? it.url : (typeof it?.link === 'string' ? it.link : site);
            const mrp = Math.round(Number(it?.mrp ?? it?.list_price ?? NaN));
            items.push(newRawItem(ctx.source, {
              title: pack ? `${name} (${pack})` : name.slice(0, 200),
              brand: String(it?.brand || seller).slice(0, 100),
              price, currency: 'INR',
              seller, sellerUrl: /^https?:\/\//.test(link) ? link : site,
              ...(img ? { images: [img.slice(0, 400)] } : {}),
              location: { city: ctx.query.location?.city || '' },
              attributes: {
                product: name.slice(0, 200),
                ...(pack ? { pack_size: pack.slice(0, 60) } : {}),
                ...(pincode ? { delivery_pincode: pincode } : {}),
                ...(Number.isFinite(mrp) && mrp > price ? { mrp: String(mrp) } : {}),
                ...(it?.sku_id || it?.product_id ? { sku: String(it.sku_id ?? it.product_id).slice(0, 60) } : {}),
                platform: seller,
                price_basis: 'Live search price via QuickCommerce API on ' + new Date().toISOString().slice(0, 10),
                data_note: 'Price from api.quickcommerceapi.com (Actowiz) for the delivery zone; verify on ' + seller + ' at checkout',
              },
              identifiers: { sku: `${apiPlatform}-${String(it?.sku_id ?? it?.product_id ?? name).slice(0, 40)}`.toLowerCase().replace(/\s+/g, '-') },
              evidence: { sourceUrl: url, sourceReference: name.slice(0, 80), extractedFields: ['name', 'price'] },
            }));
            emitted += 1;
          }
        }
        if (!items.length) {
          throw new AcquisitionError('EMPTY_RESPONSE', `QuickCommerce API returned no products${errors.length ? ` (${errors.join('; ').slice(0, 200)})` : ''}`);
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
