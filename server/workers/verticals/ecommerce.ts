/**
 * E-Commerce worker (India). Runs only for ecommerce searches.
 * Tasks: Amazon.in and Flipkart live search pages (plain HTTP, parsed from the
 * SSR markup/embedded state); Open Library stays as the existing structured source.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseAmazonIn, extractAmazonGallery } from '../parsers/amazonIn';
import { parseFlipkart } from '../parsers/flipkart';
import { parseMyntra } from '../parsers/myntra';
import { parseAjio } from '../parsers/ajio';
import { parseTataCliq } from '../parsers/tatacliq';
import { parseNykaa } from '../parsers/nykaa';
import { parseCromaSearch, extractCromaGallery, mergeCromaGallery } from '../parsers/croma';
import { parseXiaomiSearch } from '../parsers/xiaomi';
import { parseJiomart } from '../parsers/jiomart';
import { parseRelianceDigital } from '../parsers/relianceDigital';
import { createCipheriv } from 'node:crypto';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

const q = (ctx: { query: any }) => String(ctx.query.entityName || ctx.query.rawQuery || '').trim();

/**
 * JioMart catalog auth requires a MATCHING (pincode, city) pair in x-location-detail.
 * When the user gave only a pincode, map its first two digits to the city; unknown
 * prefixes fall back to the verified default pair (400070/Mumbai) at the call site.
 */
const JM_PIN_CITY: Record<string, string> = {
  '11': 'Delhi', '40': 'Mumbai', '56': 'Bengaluru', '60': 'Chennai', '70': 'Kolkata',
  '50': 'Hyderabad', '45': 'Indore', '30': 'Jaipur', '41': 'Pune', '38': 'Ahmedabad',
  '46': 'Bhopal', '80': 'Patna', '68': 'Kochi', '32': 'Lucknow', '22': 'Mumbai',
  '14': 'Chandigarh', '44': 'Nagpur', '25': 'Surat', '78': 'Siliguri', '58': 'Jabalpur',
};
function jmCityForPin(pincode: string): string | undefined {
  if (!/^\d{6}$/.test(pincode)) return undefined;
  return JM_PIN_CITY[pincode.slice(0, 2)];
}


/**
 * Owner rule (15 Oct): every e-commerce product card must show multiple images.
 * Amazon's SRP cards carry only the hero shot, so we fetch the product page for
 * the top few parsed offers and lift the colorImages hiRes[] gallery. Strictly
 * soft-fail: any non-200/challenge/blocked PDP keeps the SRP single image.
 */
async function enrichAmazonGalleries(items: any[], jar: any): Promise<any[]> {
  const targets = items.filter((it) => it.identifiers?.vendorProductId).slice(0, 3);
  for (const it of targets) {
    try {
      const asin = String(it.identifiers.vendorProductId);
      await new Promise((res) => setTimeout(res, 900));
      const r = await cffiFetch(`https://www.amazon.in/dp/${asin}`, { cookies: jar, timeoutMs: 12_000 });
      if (r.status !== 200 || r.body.includes('bm-verify') || looksLikeChallenge(r.body)) continue;
      const gallery = extractAmazonGallery(r.body);
      if (gallery.length >= 2) {
        it.attributes = it.attributes || {};
        it.attributes.image_urls = gallery.join('|');
        if (!it.attributes.image_url && gallery[0]) it.attributes.image_url = gallery[0];
        it.evidence = it.evidence || {};
        it.evidence.extractedFields = [...new Set([...(it.evidence.extractedFields || []), 'pdp_gallery'])];
      }
    } catch { /* soft-fail: keep SRP image */ }
  }
  return items;
}

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
        let jar: any = (r1 as any).cookies;
        body = r1.body; status = r1.status;
        if (status === 200 && body.includes('bm-verify')) {
          const m = body.match(/URL='([^']+)'/);
          if (m) {
            const vUrl = m[1].startsWith('/') ? 'https://www.amazon.in' + m[1] : m[1];
            await new Promise((res) => setTimeout(res, 1200));
            const r2 = await cffiFetch(vUrl, { cookies: jar, returnCookies: true, timeoutMs: 22_000 });
            jar = (r2 as any).cookies || jar;
            body = r2.body; status = r2.status;
            // one more bounce in case the edge chains tokens
            if (status === 200 && body.includes('bm-verify')) {
              const m2 = body.match(/URL='([^']+)'/);
              if (m2) {
                await new Promise((res) => setTimeout(res, 1200));
                const v2 = m2[1].startsWith('/') ? 'https://www.amazon.in' + m2[1] : m2[1];
                const r3 = await cffiFetch(v2, { cookies: jar, timeoutMs: 22_000 });
                body = r3.body; status = r3.status;
              }
            }
          }
        }
        // Amazon.in intermittently 503s (edge throttle, not a gate) — one honest retry
        if (status === 503) {
          await new Promise((res) => setTimeout(res, 2500));
          const r4 = await cffiFetch(url, { timeoutMs: 18_000, returnCookies: true });
          jar = (r4 as any).cookies || jar;
          body = r4.body; status = r4.status;
          if (status === 200 && body.includes('bm-verify')) {
            const m3 = body.match(/URL='([^']+)'/);
            if (m3) {
              await new Promise((res) => setTimeout(res, 1200));
              const v3 = m3[1].startsWith('/') ? 'https://www.amazon.in' + m3[1] : m3[1];
              const r5: any = await cffiFetch(v3, { cookies: jar, timeoutMs: 22_000 });
              body = r5.body; status = r5.status;
            }
          }
        }
        if (status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', 'Amazon.in HTTP 403 (edge denied)', 403);
        if (status !== 200) throw new AcquisitionError('SERVER_ERROR', `Amazon.in HTTP ${status}`, status);
        const items = parseAmazonIn(body, ctx.source, url);
        if (items.length) return enrichAmazonGalleries(items, jar);
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
    {
      // Reliance Digital: Fynd/Jio-platform SSR storefront; window.__INITIAL_STATE__
      // carries productListingPage.productlists.items[] with real INR prices + images.
      sourceId: 'w_ecom_reliance_digital',
      name: 'Ecom worker: Reliance Digital (SSR __INITIAL_STATE__)',
      priority: 14,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(term)}`;
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (r.status === 403 || r.status === 429) {
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Reliance Digital blocked: ${r.status}`, r.status);
        }
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Reliance Digital HTTP ${r.status}`, r.status);
        const items = parseRelianceDigital(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Reliance Digital had no priced products for this query');
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
    {
      // Nykaa: SSR search page embeds the full result set in
      // <script id="__PRELOADED_STATE__"> -> listingV2.products[] (17 Oct 2026).
      sourceId: 'w_ecom_nykaa',
      name: 'Ecom worker: Nykaa (SSR preloaded state)',
      priority: 17,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url = `https://www.nykaa.com/search/result/?q=${encodeURIComponent(term)}`;
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (r.status === 403 || r.status === 429) {
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Nykaa blocked: HTTP ${r.status}`, r.status);
        }
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Nykaa HTTP ${r.status}`, r.status);
        const items = parseNykaa(r.body, ctx.source, url);
        if (!items.length) {
          if (looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'Nykaa presented a challenge page');
          throw new AcquisitionError('EMPTY_RESPONSE', 'Nykaa carried no parseable products for this query');
        }
        return items;
      },
    },
    {
      // Croma (croma.com, Tata electronics retailer) LIVE (22 Oct 2026): the PWA
      // search BFF is an unauthenticated GET extracted from the main SPA chunk
      // (searchservices/v1/search, channel=WEB + channelCode pincode 400001).
      // Multi-image: search gives 1 hero shot; top-3 PDP fetch lifts the
      // media.tatacroma.com Images gallery (Amazon pattern, soft-fail).
      sourceId: 'w_ecom_croma',
      name: 'Ecom worker: Croma (search BFF)',
      priority: 18,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url =
          'https://api.croma.com/searchservices/v1/search?currentPage=0&query=' +
          encodeURIComponent(`${term}:relevance`) +
          '&fields=FULL&channel=WEB&channelCode=400001';
        const r = await cffiFetch(url, {
          impersonate: 'chrome',
          timeoutMs: 20_000,
          headers: { Accept: 'application/json', Referer: 'https://www.croma.com/searchB' },
        });
        if (r.status === 403 || r.status === 429) {
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Croma blocked: HTTP ${r.status}`, r.status);
        }
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Croma search BFF HTTP ${r.status}`, r.status);
        const items = parseCromaSearch(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Croma search BFF returned no parseable products');
        // Gallery enrichment for the top 3 offers (owner multi-image rule).
        const pin = String(ctx.query.location?.pincode || '').trim();
        for (const it of items.filter((x: any) => x.identifiers?.sku).slice(0, 3)) {
          try {
            await new Promise((res) => setTimeout(res, 900));
            const pdpUrl = String((it.attributes as any)?.sellerUrl || it.sellerUrl || '');
            const pr = await cffiFetch(pdpUrl || 'https://www.croma.com', { impersonate: 'chrome', timeoutMs: 15_000 });
            if (pr.status !== 200) continue;
            const gallery = extractCromaGallery(pr.body, String((it as any).identifiers?.sku || ''));
            if (gallery.length >= 2) {
              mergeCromaGallery(it, gallery);
              it.evidence = it.evidence || {};
              it.evidence.extractedFields = [...new Set([...(it.evidence.extractedFields || []), 'pdp_gallery'])];
            }
          } catch { /* soft-fail: keep search hero image */ }
        }
        return items;
      },
    },
    {
      // Xiaomi India (mi.com — Redmi/Poco/Xiaomi, owner request 22 Oct) LIVE: the
      // storefront SPA fetches its search results from the goSite BFF, an
      // unauthenticated GET (cracked from the SPPS bundle chunk 33572:
      // url = goSite + "/v2/search/result", params word/type=2/page_size/from=pc).
      // Multi-image: the payload's commodity[] variants carry distinct colour shots,
      // merged into attributes.image_urls by the parser (no PDP fetch needed).
      sourceId: 'w_ecom_xiaomi',
      name: 'Ecom worker: Xiaomi India / Redmi (goSite search BFF)',
      priority: 18,
      maxPerMinute: 8,
      timeoutMs: 25_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const url =
          'https://in-go.buy.mi.com/in/v2/search/result?word=' + encodeURIComponent(term) +
          '&type=2&page_index=0&page_size=24&v2_page_index=0&v2_page_size=24&from=pc';
        const r = await cffiFetch(url, {
          impersonate: 'chrome',
          timeoutMs: 20_000,
          headers: { Accept: 'application/json', Referer: `https://www.mi.com/in/search/${encodeURIComponent(term)}` },
        });
        if (r.status === 403 || r.status === 429) {
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Xiaomi goSite blocked: HTTP ${r.status}`, r.status);
        }
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Xiaomi goSite HTTP ${r.status}`, r.status);
        const items = parseXiaomiSearch(r.body, ctx.source, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Xiaomi search BFF returned no parseable products');
        return items;
      },
    },
    // ---- Owner-requested additions (17 Oct 2026): attempted live every search, honestly reported ----
    {
      // JioMart (Fynd/JCP platform) LIVE (17 Oct 2026): the catalog API
      // /api/service/application/catalog/v1.0/products/ is guest-accessible with two
      // headers lifted from the web theme bundle (themeBundle.umd.js):
      //   Authorization: Bearer base64(applicationID:applicationToken)
      //   x-location-detail: {"pincode","city","country_code"} (pincode+city must match)
      // No guest-JWT mint is needed; the application bearer itself authenticates.
      sourceId: 'w_ecom_jiomart',
      name: 'Ecom worker: JioMart (Fynd catalog v1.0)',
      priority: 17,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const term = q(ctx);
        if (!term) return [];
        const JM_APP_ID = '685945f46c8c7aee3f3af605';
        const JM_APP_TOKEN = 'TpKw7wD9h';
        const auth = 'Bearer ' + Buffer.from(`${JM_APP_ID}:${JM_APP_TOKEN}`).toString('base64');
        const api = (pin: string, city: string) =>
          `https://www.jiomart.com/api/service/application/catalog/v1.0/products/?q=${encodeURIComponent(term)}&page_no=1&page_size=40&pincode=${encodeURIComponent(pin)}`;
        const headers = (pin: string, city: string) => ({
          Accept: 'application/json',
          Authorization: auth,
          'x-location-detail': JSON.stringify({ pincode: pin, city, country_code: '91' }),
          Referer: 'https://www.jiomart.com/',
        });

        // Candidate (pincode, city) pairs: user-provided first (they must match),
        // then a verified serviceable default (Mumbai 400070).
        const userPin = String(ctx.query.location?.pincode || '').trim();
        const userCity = String(ctx.query.location?.city || '').trim();
        const attempts: Array<{ pin: string; city: string }> = [];
        if (userPin && userCity) attempts.push({ pin: userPin, city: userCity });
        else if (userPin) {
          const c = jmCityForPin(userPin);
          if (c) attempts.push({ pin: userPin, city: c });
        }
        attempts.push({ pin: '400070', city: 'Mumbai' });

        let lastStatus = 0; let lastBody = '';
        for (const a of attempts) {
          const r = await cffiFetch(api(a.pin, a.city), { impersonate: 'chrome', timeoutMs: 25_000, headers: headers(a.pin, a.city) });
          if (r.status === 200) {
            const items = parseJiomart(r.body, ctx.source, api(a.pin, a.city));
            if (items.length) return items;
            lastStatus = 200; lastBody = r.body;
            continue; // empty page for this pincode: try the next pair honestly
          }
          if (r.status === 400 && r.body.includes('invalid pincode')) { lastStatus = 400; lastBody = r.body; continue; }
          if (r.status === 401 || r.status === 403) throw new AcquisitionError('ACCESS_CHALLENGE', `JioMart auth rejected: HTTP ${r.status}`, r.status);
          if (r.status === 429) throw new AcquisitionError('RATE_LIMITED', `JioMart throttled: HTTP ${r.status}`, r.status);
          lastStatus = r.status; lastBody = r.body;
        }
        if (lastStatus === 200 || (lastStatus === 400 && lastBody.includes('invalid pincode'))) {
          throw new AcquisitionError('EMPTY_RESPONSE', 'JioMart catalog returned no parseable products for this query');
        }
        throw new AcquisitionError('SERVER_ERROR', `JioMart HTTP ${lastStatus}`, lastStatus);
      },
    },
    {
      // Snapdeal: WAF 403 on every TLS fingerprint (chrome110-124, edge, safari, iOS);
      // m.snapdeal.com serves a client-rendered shell. APK recon queued.
      sourceId: 'w_ecom_snapdeal',
      name: 'Ecom worker: Snapdeal (probe)',
      priority: 18,
      run: async (ctx) => {
        const term = q(ctx) || 'products';
        const r = await cffiFetch(`https://www.snapdeal.com/search?keyword=${encodeURIComponent(term)}`, { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError(
          'ACCESS_CHALLENGE',
          r.status === 403
            ? 'Snapdeal WAF denies datacenter/browserless fingerprints on all TLS profiles; mobile web is a client-rendered shell.'
            : `Snapdeal acquisition failed (HTTP ${r.status}); no browserless product API known.`,
          r.status || 403
        );
      },
    },
    {
      // Tata Neu: the web (tataneu.com) is an app-marketing shell; all commerce
      // (CLiQ/Croma/1mg/BigBasket) happens in the app. Tata CLiQ — its web
      // storefront arm — is already a live source (w_ecom_tatacliq).
      sourceId: 'w_ecom_tataneu',
      name: 'Ecom worker: Tata Neu (probe)',
      priority: 18,
      run: async (_ctx) => {
        throw new AcquisitionError('EMPTY_RESPONSE', 'Tata Neu commerce is app-only (tataneu.com is a marketing shell with no web search/pricing); its web storefront arm Tata CLiQ is a live source. Tata Neu offers, when surfaced, will state "available only on app".');
      },
    },
  ],
};

registerVerticalWorker(ecommerceWorker);
