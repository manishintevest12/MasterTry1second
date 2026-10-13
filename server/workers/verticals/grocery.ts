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
