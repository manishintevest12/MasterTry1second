/**
 * Grocery worker (India). A grocery search runs ONLY this worker.
 * Real product prices for grocery queries from Amazon.in and Flipkart grocery
 * listings (same SSR markup as the ecommerce worker, grocery-scoped queries).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { AcquisitionError } from '../../common/httpClient';

const q = (ctx: { query: any }) =>
  String(ctx.query.entityName || ctx.query.rawQuery || '')
    .replace(/\b(grocery|quick|10 min|instant|order|buy)\b/gi, ' ').replace(/\s+/g, ' ').trim();

export const groceryWorker: VerticalWorker = {
  vertical: 'grocery',
  tasks: [
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
