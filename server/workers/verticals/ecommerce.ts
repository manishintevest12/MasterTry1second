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
import { parseTataCliq } from '../parsers/tatacliq';
import { createCipheriv } from 'node:crypto';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

const q = (ctx: { query: any }) => String(ctx.query.entityName || ctx.query.rawQuery || '').trim();

export const ecommerceWorker: VerticalWorker = {
  vertical: 'ecommerce',
  tasks: [
    {
      sourceId: 'w_ecom_amazon_in',
      // Amazon.in now fronts repeated browserless hits with an Imperva "bm-verify"
      // interstitial: HTTP 200 + <meta refresh URL='...?bm-verify=TOKEN'>. Following
      // that URL once with the SAME cookie session returns the real results page,
      // so we run the acquisition as a cffi session handshake instead of a plain GET.
      timeoutMs: 40_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
        let body = '';
        let status = 0;
        const r1 = await cffiFetch(url, { timeoutMs: 18_000, returnCookies: true });
        body = r1.body; status = r1.status;
        if (status === 200 && body.includes('bm-verify')) {
          const m = body.match(/URL='([^']+)'/);
          if (m) {
            const vUrl = m[1].startsWith('/') ? 'https://www.amazon.in' + m[1] : m[1];
            await new Promise((res) => setTimeout(res, 1200));
            const r2 = await cffiFetch(vUrl, { cookies: r1.cookies, returnCookies: true, timeoutMs: 22_000 });
            body = r2.body; status = r2.status;
            // one more bounce in case the edge chains tokens
            if (status === 200 && body.includes('bm-verify')) {
              const m2 = body.match(/URL='([^']+)'/);
              if (m2) {
                await new Promise((res) => setTimeout(res, 1200));
                const v2 = m2[1].startsWith('/') ? 'https://www.amazon.in' + m2[1] : m2[1];
                const r3 = await cffiFetch(v2, { cookies: r2.cookies, timeoutMs: 22_000 });
                body = r3.body; status = r3.status;
              }
            }
          }
        }
        if (status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in HTTP 403 (edge denied)', 403);
        if (status !== 200) throw new AcquisitionError('FORBIDDEN', `Amazon.in HTTP ${status}`, status);
        const items = parseAmazonIn(body, ctx.source, url);
        if (items.length) return items;
        if (body.includes('bm-verify') || looksLikeChallenge(body)) {
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in presented a bm-verify challenge that did not clear');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', `Amazon.in carried no parseable products (body ${body.length} bytes)`);
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
      // Tata CLiQ: web SPA's search BFF (reverse-engineered 13 Oct 2026).
      // x-auth / X-ACCESS-TOKEN = AES-192-CBC(current epoch seconds) with a
      // key extracted from the obfuscated client bundle; body is pure JSON.
      sourceId: 'w_ecom_tatacliq',
      name: 'Ecom worker: Tata CLiQ (search BFF)',
      priority: 16,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const searchText = encodeURIComponent(`${term}:relevance:inStockFlag:true`);
        const params =
          'isTextSearch=true&isFilter=false&qc=false&page=0&isKeywordRedirect=true&isKeywordRedirectEnabled=true' +
          '&isFilterDataRequired=false&isMDE=true&isSuggested=false&isPwa=true&pageSize=20&typeID=all&channel=mobile';
        const url =
          `https://searchbff.tatacliq.com/v2/products/mpl/search?searchText=${searchText}&${params}` +
          `&originalSearchText=${encodeURIComponent(term)}`;
        // AES-192 key lives (obfuscated) in the SPA bundle: client.60bf524baa78.js
        const key = 'Vwdu3LWvHSOhAusUG9xfFw==';
        const ts = String(Math.floor(Date.now() / 1000));
        const cipher = createCipheriv('aes-192-cbc', Buffer.from(key, 'utf8'), Buffer.alloc(16, 0));
        const token = cipher.update(ts, 'utf8', 'base64') + cipher.final('base64');
        const r = await cffiFetch(url, {
          impersonate: 'chrome',
          timeoutMs: 15_000,
          headers: {
            Accept: 'application/json',
            authorization: 'Bearer ',
            'x-auth': token,
            'X-ACCESS-TOKEN': token,
          },
        });
        if (r.status === 401) throw new AcquisitionError('ACCESS_CHALLENGE', 'Tata CLiQ search BFF rejected the x-auth token', r.status);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Tata CLiQ search BFF HTTP ${r.status}`, r.status);
        const items = parseTataCliq(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Tata CLiQ search BFF returned no parseable products');
        return items;
      },
    },
  ],
};

registerVerticalWorker(ecommerceWorker);
