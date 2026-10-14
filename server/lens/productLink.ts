/**
 * Price Lens: paste ANY product link -> find the same product's cheapest price across sites.
 *
 * Honest by construction (no-fabrication rule):
 *  - The product title comes ONLY from the page the user pasted (JSON-LD / og:title / <title>)
 *    or, if that page is bot-gated, from the words in the URL slug itself.
 *  - Prices come ONLY from the real /api/search pipeline. This module never invents a price.
 *  - The pasted page's own price (when it publishes one) is reported separately as "pagePrice".
 */
import * as cheerio from 'cheerio';
import { cffiFetch } from '../common/curlCffiFetch';

export interface LinkProduct {
  title: string | null;
  titleSource: 'json-ld' | 'og' | 'page-title' | 'url-slug' | 'none';
  merchant: string;            // "Amazon India", "Flipkart", or the bare domain
  domain: string;
  pagePrice: number | null;    // price the pasted page itself shows, when it publishes one
  image: string | null;
  fetchStatus: 'ok' | 'blocked' | 'failed' | 'skipped';
}

const MERCHANTS: Array<[RegExp, string]> = [
  [/(^|\.)amazon\.(in|com)$/, 'Amazon India'],
  [/(^|\.)flipkart\.com$/, 'Flipkart'],
  [/(^|\.)myntra\.com$/, 'Myntra'],
  [/(^|\.)ajio\.com$/, 'Ajio'],
  [/(^|\.)tatacliq\.com$/, 'Tata CLiQ'],
  [/(^|\.)meesho\.com$/, 'Meesho'],
  [/(^|\.)nykaa\.com$/, 'Nykaa'],
  [/(^|\.)croma\.com$/, 'Croma'],
  [/(^|\.)reliancedigital\.in$/, 'Reliance Digital'],
  [/(^|\.)snapdeal\.com$/, 'Snapdeal'],
  [/(^|\.)jiomart\.com$/, 'JioMart'],
  [/(^|\.)lenskart\.com$/, 'Lenskart'],
  [/(^|\.)bigbasket\.com$/, 'BigBasket'],
  [/(^|\.)blinkit\.com$/, 'Blinkit'],
  [/(^|\.)zeptonow\.com$/, 'Zepto'],
  [/(^|\.)swiggy\.com$/, 'Swiggy'],
  [/(^|\.)buyhatke\.com$/, 'BuyHatke'],
  [/(^|\.)pricehistory\.app$/, 'PriceHistory'],
];

/** Blocks localhost / private / link-local / metadata hosts so the lens can't be used to probe our network. */
export function isSafePublicUrl(raw: string): { ok: boolean; url?: URL; reason?: string } {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch { return { ok: false, reason: 'Not a valid link' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'Only http(s) links are supported' };
  if (u.username || u.password) return { ok: false, reason: 'Links with credentials are not allowed' };
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return { ok: false, reason: 'That host is not allowed' };
  if (/^\[/.test(h) || h.includes(':')) return { ok: false, reason: 'IPv6 hosts are not allowed' };
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) {
      return { ok: false, reason: 'Private network addresses are not allowed' };
    }
  }
  if (u.href.length > 2000) return { ok: false, reason: 'Link is too long' };
  return { ok: true, url: u };
}

/** First link inside free text, e.g. a "share" blurb: "Check this out https://dl.flipkart.com/s/abc". */
export function extractUrl(text: string): string | null {
  const m = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;]+$/, '') : null;
}

export function merchantFor(host: string): string {
  const h = host.replace(/^www\./, '').toLowerCase();
  for (const [re, name] of MERCHANTS) if (re.test(h)) return name;
  return h;
}

const JUNK_SLUG = /^(dp|gp|p|product|products|item|itm|buy|pd|shop|s|ip|sku|b0[a-z0-9]{8}|[a-z]{0,3}\d[a-z0-9]{6,})$/i;

/** Readable product words from a URL path, e.g. /Apple-iPhone-17-Black-256-GB/p/itm123 -> "Apple iPhone 17 Black 256 GB". */
export function titleFromSlug(u: URL): string | null {
  const segs = decodeURIComponent(u.pathname).split('/').filter(Boolean);
  let best = '';
  for (const seg of segs) {
    const words = seg.replace(/\.(html?|php|aspx?)$/i, '').split(/[-_+]+/).filter(Boolean);
    const good = words.filter((w) => !JUNK_SLUG.test(w) && !/^\d{8,}$/.test(w));
    if (good.length >= 2 && good.join(' ').length > best.length) best = good.join(' ');
  }
  best = best.replace(/\s+/g, ' ').trim();
  // Tracker slugs: "flipkart apple iphone 17 black 256 gb price in india 2 224849352"
  if (/(^|\.)(buyhatke|pricehistory)\./i.test(u.hostname) || /\bprice in india\b/i.test(best)) {
    best = best
      .replace(/^(amazon|flipkart|myntra|ajio|tata cliq|tatacliq|meesho|nykaa|croma|snapdeal|jiomart)\s+/i, '')
      .replace(/\s+price in india.*$/i, '')
      .replace(/\s+\d{0,3}\s*\d{6,}$/i, '')
      .trim();
  }
  return best.length >= 4 ? best.slice(0, 160) : null;
}

/**
 * Price-tracker / comparison sites wrap the real product name:
 *   "Price History of Apple iPhone 17 (Black, 256 GB) from Flipkart 2_224849352"
 *   "Apple iPhone 17 Price in India - Buy at Rs 86,999 | BuyHatke"
 * Keep only the product name so the search uses the product, not the tracker's words.
 */
export function stripComparisonBoilerplate(t: string): string {
  let x = String(t || '').trim();
  x = x.replace(/^(price\s+history|price\s+tracker|price\s+comparison|compare\s+prices?)\s+(of|for)\s+/i, '');
  x = x.replace(/\s+from\s+(amazon(\.in)?|flipkart|myntra|ajio|tata\s?cliq|meesho|nykaa|croma|reliance\s?digital|snapdeal|jiomart)\b.*$/i, '');
  x = x.replace(/\s*[|\u2013\u2014-]\s*(buyhatke|pricehistory\.app|pricebefore|smartprix|91mobiles|pricetree|mysmartprice|compareraja|desidime)[^|]*$/i, '');
  x = x.replace(/\s+price\s+in\s+india\b.*$/i, '');
  x = x.replace(/\s+(online\s+)?(price|prices)\s*(history|tracker|drop|comparison)?\s*$/i, '');
  return x.replace(/\s+/g, ' ').trim();
}

/** Cleans store boilerplate off a page title: "Buy X Online at Best Price | Amazon.in" -> "X". */
export function cleanTitle(t: string): string {
  return stripComparisonBoilerplate(t)
    .replace(/\s*[|\u2013\u2014-]\s*(amazon\.in|flipkart\.com|myntra|ajio|tata ?cliq|meesho|nykaa|croma|reliance digital|snapdeal|jiomart|lenskart|bigbasket|blinkit)[^|]*$/i, '')
    .replace(/^(buy|shop)\s+/i, '')
    .replace(/\s+(online|at best price|best price)\b.*$/i, '')
    .replace(/\s*:\s*amazon\.in.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function priceNum(v: unknown): number | null {
  const n = Math.round(parseFloat(String(v ?? '').replace(/[^\d.]/g, '')));
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? n : null;
}

/**
 * Marketplace titles are keyword-stuffed ("boAt Airdopes 141/8, Low Latency, ENx Tech, 42HRS Battery ...").
 * The product identity is the part before the first marketing comma; keep brand + model + a capacity/variant in parens.
 */
export function searchableTitle(t: string): string {
  const paren = t.match(/\(([^)]{2,40})\)/);
  const noParen = t.replace(/\([^)]*\)/g, ' ');
  let head = noParen.split(/\s*[,|]\s*|\s+-\s+|\s+with\s+/i)[0].replace(/\/(\d+)\b/g, '').replace(/\s+/g, ' ').trim();
  const words = head.split(' ');
  if (words.length > 8) head = words.slice(0, 8).join(' ');
  // keep storage/variant info (e.g. "Black, 256 GB") only when it carries a capacity, which is part of identity
  const cap = paren && /\d+\s?(gb|tb|ml|l|kg|g)\b/i.test(paren[1]) ? ` ${paren[1].match(/\d+\s?(gb|tb|ml|l|kg|g)\b/i)![0].replace(/\s+/, '')}` : '';
  return (head + cap).trim() || t.slice(0, 80);
}


/** A "title" that is only the merchant/domain name is a bot wall (e.g. Amazon's interstitial <title>Amazon.in</title>), not a product. */
export function isMerchantNameTitle(title: string | null, domain: string, merchant: string): boolean {
  if (!title) return false;
  const plain = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  return plain(title) === plain(domain) || plain(title) === plain(merchant);
}

/** Pure HTML parser (exported for tests): JSON-LD Product > og:title > <title>. */
export function parseProductHtml(html: string): Pick<LinkProduct, 'title' | 'titleSource' | 'pagePrice' | 'image'> {
  const $ = cheerio.load(html);
  let title: string | null = null;
  let titleSource: LinkProduct['titleSource'] = 'none';
  let pagePrice: number | null = null;
  let image: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (title) return;
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes: any[] = Array.isArray(data) ? data : data?.['@graph'] ? data['@graph'] : [data];
      for (const n of nodes) {
        const type = Array.isArray(n?.['@type']) ? n['@type'] : [n?.['@type']];
        if (type.includes('Product') && n.name) {
          title = cleanTitle(String(n.name));
          titleSource = 'json-ld';
          const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          pagePrice = priceNum(offer?.price ?? offer?.lowPrice);
          const img = Array.isArray(n.image) ? n.image[0] : n.image;
          image = typeof img === 'string' && img.startsWith('https://') ? img : null;
          break;
        }
      }
    } catch { /* malformed JSON-LD: try the next block */ }
  });

  if (!title) {
    const og = $('meta[property="og:title"]').attr('content');
    if (og && og.trim().length > 3) { title = cleanTitle(og); titleSource = 'og'; }
  }
  if (!title) {
    const t = $('title').first().text();
    if (t && t.trim().length > 3) { title = cleanTitle(t); titleSource = 'page-title'; }
  }
  if (!pagePrice) pagePrice = priceNum($('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content'));
  if (!image) {
    const ogi = $('meta[property="og:image"]').attr('content');
    image = ogi && ogi.startsWith('https://') ? ogi : null;
  }
  // A page title that is clearly a bot wall is not a product.
  if (title && /(access denied|robot check|captcha|just a moment|attention required|are you a human|request blocked)/i.test(title)) {
    return { title: null, titleSource: 'none', pagePrice: null, image: null };
  }
  return { title, titleSource, pagePrice, image };
}


/** Amazon fronts repeated browserless hits with an Imperva bm-verify interstitial whose
 * <title> is just "Amazon.in". Follow the meta-refresh verification URL with the same
 * cookie jar (same trick as the ecommerce worker) to load the real product page. */
async function amazonBounceFetch(url: string): Promise<string | null> {
  const r1: any = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 18_000, returnCookies: true });
  let body = r1?.body;
  let jar = r1?.cookies;
  for (let hop = 0; hop < 2; hop++) {
    if (!(body && body.includes('bm-verify'))) break;
    const m = String(body).match(/URL='([^']+)'/);
    if (!m) break;
    const v = m[1].startsWith('/') ? new URL(m[1], url).href : m[1];
    await new Promise((res) => setTimeout(res, 1200));
    const r2: any = await cffiFetch(v, { impersonate: 'chrome', cookies: jar, returnCookies: true, timeoutMs: 22_000 });
    body = r2?.body; jar = r2?.cookies;
  }
  return body && body.includes('bm-verify') ? null : (body || null);
}

/** Resolve a pasted link to a product. Never throws; reports how much it could honestly learn. */
export async function resolveProductFromLink(rawUrl: string): Promise<LinkProduct> {
  const safe = isSafePublicUrl(rawUrl);
  if (!safe.ok || !safe.url) {
    return { title: null, titleSource: 'none', merchant: '', domain: '', pagePrice: null, image: null, fetchStatus: 'skipped' };
  }
  const u = safe.url;
  const domain = u.hostname.replace(/^www\./, '');
  const merchant = merchantFor(u.hostname);
  const slugTitle = titleFromSlug(u);

  let parsed: ReturnType<typeof parseProductHtml> = { title: null, titleSource: 'none', pagePrice: null, image: null };
  let fetchStatus: LinkProduct['fetchStatus'] = 'failed';
  const isAmazon = /(^|\.)amazon\.[a-z.]+$/i.test(u.hostname);
  try {
    if (isAmazon) {
      const body = await amazonBounceFetch(u.href);
      if (body) {
        parsed = parseProductHtml(body.slice(0, 3_000_000));
        fetchStatus = 'ok';
      } else {
        fetchStatus = 'blocked';
      }
    } else {
      const res = await cffiFetch(u.href, {
        impersonate: 'chrome',
        timeoutMs: 12_000,
        headers: { 'Accept-Language': 'en-IN,en;q=0.9', Accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status >= 200 && res.status < 300 && res.body) {
        parsed = parseProductHtml(res.body.slice(0, 3_000_000));
        fetchStatus = 'ok';
      } else {
        fetchStatus = res.status === 403 || res.status === 429 || res.status === 503 ? 'blocked' : 'failed';
      }
    }
  } catch { fetchStatus = 'failed'; }

  // A "title" that is only the merchant/domain name is a bot wall, not a product.
  if (isMerchantNameTitle(parsed.title, domain, merchant)) {
    parsed = { title: null, titleSource: 'none', pagePrice: null, image: null };
    if (fetchStatus === 'ok') fetchStatus = 'blocked';
  }

  // Page title wins; when the site is bot-gated the product words in the URL are still the user's own input.
  if (parsed.title) return { ...parsed, title: parsed.title, merchant, domain, fetchStatus };
  if (slugTitle) return { title: slugTitle, titleSource: 'url-slug', merchant, domain, pagePrice: null, image: null, fetchStatus };
  return { title: null, titleSource: 'none', merchant, domain, pagePrice: null, image: null, fetchStatus };
}
