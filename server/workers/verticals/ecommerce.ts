/**
 * E-Commerce worker (India). Runs only for ecommerce searches.
 * Tasks: Amazon.in and Flipkart live search pages (plain HTTP, parsed from the
 * SSR markup/embedded state); Open Library stays as the existing structured source.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { AcquisitionError } from '../../common/httpClient';

const q = (ctx: { query: any }) => String(ctx.query.entityName || ctx.query.rawQuery || '').trim();

export const ecommerceWorker: VerticalWorker = {
  vertical: 'ecommerce',
  tasks: [
    {
      sourceId: 'w_ecom_amazon_in',
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
      sourceId: 'w_ecom_flipkart',
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

registerVerticalWorker(ecommerceWorker);
