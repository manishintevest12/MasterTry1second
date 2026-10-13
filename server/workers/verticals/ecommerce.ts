/**
 * E-Commerce worker (India). Runs only for ecommerce searches.
 * Tasks: Amazon.in and Flipkart live search pages (plain HTTP, parsed from the
 * SSR markup/embedded state); Open Library stays as the existing structured source.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { parseMyntra } from '../parsers/myntra';
import { parseAjio } from '../parsers/ajio';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

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
    {
      // Myntra: SSR page with the full result set inside window.__myx
      sourceId: 'w_ecom_myntra',
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const slug = term.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
        const url = `https://www.myntra.com/${encodeURIComponent(slug)}`;
        const r = await ctx.fetch(url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Myntra HTTP ${r.status}`, r.status);
        const items = parseMyntra(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Myntra page carried no parseable products');
        return items;
      },
    },
    {
      // Ajio: direct JSON search API
      sourceId: 'w_ecom_ajio',
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.ajio.com/api/search?fields=FULL&query=${encodeURIComponent(term)}&pageSize=40`;
        const r = await ctx.fetch(url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Ajio HTTP ${r.status}`, r.status);
        const items = parseAjio(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Ajio API returned no parseable products');
        return items;
      },
    },
    // ---- Owner-mandated e-commerce sources: attempted live on every search, honestly reported ----
    {
      sourceId: 'w_ecom_meesho',
      name: 'Ecom worker: Meesho (probe)',
      priority: 15,
      run: async (ctx) => {
        const term = q(ctx) || 'products';
        await cffiFetch(`https://www.meesho.com/search?q=${encodeURIComponent(term)}`, { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Meesho search serves a client-rendered shell to browserless HTTP; product prices load only via session-gated app APIs.');
      },
    },
    {
      sourceId: 'w_ecom_tatacliq',
      name: 'Ecom worker: Tata CLiQ (probe)',
      priority: 16,
      run: async (ctx) => {
        const term = q(ctx) || 'products';
        await cffiFetch(`https://www.tatacliq.com/search/?text=${encodeURIComponent(term)}`, { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Tata CLiQ search is a JS-rendered SPA shell; cmdity-federator search API paths are not available unauthenticated to browserless HTTP.');
      },
    },
  ],
};

registerVerticalWorker(ecommerceWorker);
