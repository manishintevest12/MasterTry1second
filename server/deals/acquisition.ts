/**
 * Deals Acquisition Engine — real offers/coupons pulled straight from merchants via
 * curl_cffi (impersonate='chrome'), the same browserless reverse-engineering path as the
 * price engines. Nothing is invented: a deal exists only when the merchant's own page/API
 * returned it. Admin-managed deals (source='admin') are an OPTIONAL overlay and are never
 * touched here.
 *
 * Sources (verified browserless):
 *  - Myntra  /offers  : window.__myx products with live discount labels + landing links
 *  - TataCLiQ search BFF (x-auth crack) : discounted in-stock products
 *  - Amazon.in SRP (bm-verify session bounce) : coupon badges + savings per card, and the
 *    top product's dp page "Bank Offer" blocks
 */
import { createCipheriv } from 'crypto';
import { cffiFetch } from '../common/curlCffiFetch';
import { log } from '../common/logger';
import { getStore } from '../common/db';
import type { DealInput } from '../marketing/deals';
import { MERCHANT_VERTICAL } from '../marketing/deals';

export interface AcquiredDeal extends DealInput {
  dedupe_key: string;
  image_url?: string | null;
}
export interface ProviderOutcome { provider: string; ok: boolean; deals: number; error?: string }

// ---------- shared helpers ----------

const strip = (s: string) => String(s || '').replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function usd(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

// ---------- Myntra /offers (window.__myx) ----------

/** Brace-match a `window.__myx = {...}` assignment (strings may contain braces). */
function parseMyx(html: string): any | null {
  const start = /window\.__myx\s*=\s*\{/.exec(html);
  if (!start) return null;
  const from = start.index + start[0].length - 1;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(html.slice(from, end + 1)); } catch { return null; }
}

export function extractMyxDeals(root: any, limit = 24): AcquiredDeal[] {
  const products: any[] = root?.searchData?.results?.products || [];
  const out: AcquiredDeal[] = [];
  for (const p of products.slice(0, limit)) {
    const name = strip(p?.productName);
    const price = usd(p?.price);
    const disc = strip(p?.discountDisplayLabel || '').replace(/[()]/g, '');   // "69% OFF"
    if (!name || !price || !/\d+\s*%/.test(disc)) continue;
    const landing = String(p?.landingPageUrl || '').replace(/^\/+/, '');
    if (!landing) continue;
    const brand = strip(p?.brand);
    out.push({
      merchant_key: 'myntra', merchant_name: 'Myntra', kind: 'sale',
      title: clip(brand ? `${brand} ${name}` : name, 120),
      description: `Live on Myntra's offers page at ₹${price.toLocaleString('en-IN')} (MRP ₹${usd(p?.mrp) ?? price}).`,
      code: null, discount_text: disc, min_order: null,
      terms: 'Discount as listed on myntra.com/offers while the sale runs.',
      dest_url: `https://www.myntra.com/${landing}`,
      valid_till: null, sort_weight: 5,
      dedupe_key: `myntra|${p?.productId || landing.slice(0, 80)}`,
      image_url: p?.searchImage ? String(p.searchImage).replace(/^http:/, 'https:') : null,
    });
  }
  return out;
}

export async function acquireMyntraDeals(): Promise<AcquiredDeal[]> {
  const r = await cffiFetch('https://www.myntra.com/offers', { timeoutMs: 25_000 });
  if (r.status !== 200) throw new Error(`Myntra /offers HTTP ${r.status}`);
  const root = parseMyx(r.body);
  const deals = extractMyxDeals(root);
  if (!deals.length) throw new Error('Myntra /offers carried no discounted products');
  return deals;
}

// ---------- TataCLiQ search BFF (x-auth) ----------

export async function acquireTatacliqDeals(queries: string[] = ['headphones', 'sneakers', 'watch', 'kitchen appliance'], perQuery = 8): Promise<AcquiredDeal[]> {
  const key = 'Vwdu3LWvHSOhAusUG9xfFw==';
  const tokenOf = () => {
    const cipher = createCipheriv('aes-192-cbc', Buffer.from(key, 'utf8'), Buffer.alloc(16, 0));
    return cipher.update(String(Math.floor(Date.now() / 1000)), 'utf8', 'base64') + cipher.final('base64');
  };
  const out: AcquiredDeal[] = [];
  for (const term of queries) {
    const searchText = encodeURIComponent(`${term}:relevance:inStockFlag:true`);
    const url = `https://searchbff.tatacliq.com/v2/products/mpl/search?searchText=${searchText}` +
      `&originalSearchText=${encodeURIComponent(term)}&isTextSearch=true&isFilter=false&qc=false&page=0` +
      `&isMDE=true&isPwa=true&pageSize=20&typeID=all&channel=mobile`;
    const r = await cffiFetch(url, {
      timeoutMs: 15_000,
      headers: { Accept: 'application/json', authorization: 'Bearer ', 'x-auth': tokenOf(), 'X-ACCESS-TOKEN': tokenOf() },
    });
    if (r.status !== 200) throw new Error(`Tata CLiQ BFF HTTP ${r.status}`);
    out.push(...extractTatacliqDeals(r.body, perQuery));
    if (out.length >= perQuery * queries.length) break;
  }
  if (!out.length) throw new Error('Tata CLiQ BFF returned no discounted products');
  return out;
}

export function extractTatacliqDeals(body: string, cap = 32): AcquiredDeal[] {
  const out: AcquiredDeal[] = [];
  let groups: any[] = [];
  try { groups = JSON.parse(body).response || []; } catch { return out; }
  for (const g of groups) {
    const rows: any[] = g?.product_search_page?.search_result || [];
    for (const p of rows) {
        const disc = Number(p?.discountPercent) || 0;
        const price = usd(p?.price?.sellingPrice?.doubleValue);
        const raw = String(p?.webURL || '');
        // BFF returns either full https URLs or site-relative paths; anything else is not a TataCLiQ landing page
        const url2 = raw.startsWith('https://www.tatacliq.com') ? raw : raw.startsWith('/') ? `https://www.tatacliq.com${raw}` : null;
        if (disc < 40 || !price || !url2) continue;   // only real, substantial discounts
        const brand = strip(p?.brandname);
        const title = strip(p?.productTitle || p?.productname);
        out.push({
          merchant_key: 'tatacliq', merchant_name: 'Tata CLiQ', kind: 'sale',
          title: clip(brand ? `${brand} ${title}` : title, 120),
          description: `In stock on Tata CLiQ at ₹${price.toLocaleString('en-IN')} (MRP ₹${usd(p?.price?.mrpPrice?.doubleValue) ?? price}).`,
          code: null, discount_text: `${disc}% OFF`, min_order: null,
          terms: 'Price and stock as returned by tatacliq.com right now.',
          dest_url: url2, valid_till: null, sort_weight: 4,
          dedupe_key: `tatacliq|${p?.ussid || url2.slice(0, 120)}`,
          image_url: p?.imageURL ? `https:${String(p.imageURL).replace(/^\w+:?/, '')}` : null,
        });
        if (out.length >= cap) return out;
      }
    }
  return out;
}
// ---------- Amazon.in (SRP coupon badges + dp bank offers) ----------

/** SRP fetch with the Imperva bm-verify cookie-session bounce (same as the ecom worker). */
async function amazonSessionFetch(url: string): Promise<string> {
  const r1: any = await cffiFetch(url, { timeoutMs: 18_000, returnCookies: true });
  let body = r1.body;
  let jar = r1.cookies;
  for (let hop = 0; hop < 2; hop++) {
    if (!(body && body.includes('bm-verify'))) break;
    const m = body.match(/URL='([^']+)'/);
    if (!m) break;
    const v = m[1].startsWith('/') ? `https://www.amazon.in${m[1]}` : m[1];
    await new Promise((res) => setTimeout(res, 1200));
    const r2: any = await cffiFetch(v, { cookies: jar, returnCookies: true, timeoutMs: 22_000 });
    body = r2.body; jar = r2.cookies;
  }
  return body;
}

const COUPON_TXT = /(?:₹|Rs\.?\s?)\s?(\d{2,5})\s?coupon|Save (?:up to )?(?:₹|Rs\.?\s?)(\d{2,5}) with (?:coupon| promo)|(\d{1,2})% (?:with )?coupon/i;

export function extractAmazonCardDeals(html: string): AcquiredDeal[] {
  // SRP cards are delimited by data-asin="…"; slice each card's markup.
  const out: AcquiredDeal[] = [];
  const idx = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/g)].map((m) => m.index!);
  for (let c = 0; c < idx.length && out.length < 30; c++) {
    const chunk = html.slice(idx[c], c + 1 < idx.length ? idx[c + 1] : html.length);
    const coupon = COUPON_TXT.exec(chunk);
    if (!coupon) continue;
    const asin = /data-asin="([A-Z0-9]{10})"/.exec(chunk)![1];
    const title = strip((/<span class="a-size-medium[^"]*"[^>]*>(.*?)<\/span>/.exec(chunk) || [])[1] || (/<h2[^>]*>(.*?)<\/h2>/.exec(chunk) || [])[1] || '')
      .replace(/<[^>]+>/g, '');
    if (!title) continue;
    const whole = Number((/class="a-price-whole">([\d,]+)/.exec(chunk) || [])[1]?.replace(/,/g, ''));
    const amount = Number(coupon[1] || coupon[2] || 0) || null;
    const pct = coupon[3] ? Number(coupon[3]) : null;
    out.push({
      merchant_key: 'amazon', merchant_name: 'Amazon', kind: 'coupon',
      title: clip(title, 120),
      description: amount
        ? `Amazon lists a ₹${amount} clip-on coupon on this product${Number.isFinite(whole) ? ` (current price ₹${whole.toLocaleString('en-IN')})` : ''}.`
        : `Amazon lists a ${pct}% clip-on coupon on this product.`,
      code: null,   // Amazon coupons clip at the product page, they have no public code
      discount_text: amount ? `Save ₹${amount} with coupon` : `${pct}% with coupon`,
      min_order: null,
      terms: 'Clip the coupon on the product page; the discount applies at checkout.',
      dest_url: `https://www.amazon.in/dp/${asin}`,
      valid_till: null, sort_weight: 8,
      dedupe_key: `amazon-coupon|${asin}`,
      image_url: null,
    });
  }
  return out;
}

export function extractAmazonBankOffers(dpHtml: string, asin: string, title: string): AcquiredDeal[] {
  const out: AcquiredDeal[] = [];
  // Match on TAG-STRIPPED text: the earlier version matched the raw HTML and leftover tag
  // fragments ("<span class=") leaked into stored titles. Text-only matching cannot leak markup.
  const text = dpHtml
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/g, ' ');
  const re = /(?:Bank Offer|Instant (?:Discount|Cashback)|Get (?:up to )?(?:₹|Rs\.?)\s?\d[\s\S]{0,180}?offer|No Cost EMI[^.]{0,120})[\s\S]{0,260}/gi;
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const raw = strip(m[0].replace(/\s*•\s*/g, ' ')).slice(0, 220);
    if (!raw || raw.length < 20) continue;
    // An offer title must carry a real figure (₹ / Rs / %) — a bare "Bank Offer" label is not a deal.
    if (!/[₹]|Rs\.?|\d\s*%/.test(raw)) continue;
    const t = clip(strip(raw.split(/(?<=offer|EMI)\b/)[0] || raw).replace(/<|>/g, ' '), 120);
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({
      merchant_key: 'amazon', merchant_name: 'Amazon', kind: 'bank_offer',
      title: clip(t, 120),
      description: `Listed on this Amazon product page${title ? ` (${clip(title, 60)})` : ''}.`,
      code: null, discount_text: null, min_order: null,
      terms: 'Bank offer terms are shown on the product page at checkout.',
      dest_url: `https://www.amazon.in/dp/${asin}`,
      valid_till: null, sort_weight: 7,
      dedupe_key: `amazon-bank|${asin}|${t.slice(0, 100)}`,
      image_url: null,
    });
    if (out.length >= 4) break;
  }
  return out;
}

export async function acquireAmazonDeals(queries: string[] = ['air fryer', 'wireless earbuds', 'smartwatch', 'mixer grinder']): Promise<AcquiredDeal[]> {
  const out: AcquiredDeal[] = [];
  let anySrp = false;
  for (const term of queries) {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
    const body = await amazonSessionFetch(url);
    if (!body || body.length < 50_000) continue;   // gated shell — honest skip for this query
    anySrp = true;
    const cardDeals = extractAmazonCardDeals(body);
    out.push(...cardDeals);
    // bank offers from the first ASIN's product page
    const asin = (body.match(/data-asin="([A-Z0-9]{10})"/) || [])[1];
    if (asin && !out.some((d) => d.dedupe_key.startsWith('amazon-bank'))) {
      const dp = await amazonSessionFetch(`https://www.amazon.in/dp/${asin}`);
      if (dp && dp.length > 50_000) {
        const dpTitle = strip((/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/.exec(dp) || [])[1] || '');
        out.push(...extractAmazonBankOffers(dp, asin, dpTitle));
      }
    }
    if (out.length >= 40) break;
  }
  if (!anySrp) throw new Error('Amazon SRP did not load for any query (edge gate)');
  return out;
}

// ---------- sync into the deals table ----------

function cleanDeal(d: AcquiredDeal) {
  // Merchant logo as a stable image fallback so no live deal renders imageless.
  const merchantDomain: Record<string, string> = {
    amazon: 'amazon.in', flipkart: 'flipkart.com', myntra: 'myntra.com', ajio: 'ajio.com',
    tatacliq: 'tatacliq.com', shopsy: 'shopsy.in', croma: 'croma.com', nykaa: 'nykaa.com',
    redbus: 'redbus.in', abhibus: 'abhibus.com', zingbus: 'zingbus.com', dominos: 'dominos.co.in',
    pizzahut: 'pizzahut.co.in', swiggy: 'swiggy.com', zomato: 'zomato.com', eatsure: 'eatsure.com',
    blinkit: 'blinkit.com', zepto: 'zepto.com', instamart: 'swiggy.com', bigbasket: 'bigbasket.com',
    bookmyshow: 'in.bookmyshow.com', district: 'district.zomato.com', paytm: 'paytm.com',
    makemytrip: 'makemytrip.com', goibibo: 'goibibo.com', easemytrip: 'easemytrip.com',
    ixigo: 'ixigo.com', yatra: 'yatra.com', cleartrip: 'cleartrip.com', goindigo: 'goindigo.in',
    akasaair: 'akasaair.com', booking: 'booking.com', agoda: 'agoda.com', airbnb: 'airbnb.com',
    ola: 'olacabs.com', uber: 'uber.com', rapido: 'rapido.bike', savaari: 'savaari.com',
    paisabazaar: 'paisabazaar.com', bankbazaar: 'bankbazaar.com', policybazaar: 'policybazaar.com',
    moneyview: 'moneyview.in', kreditbee: 'kreditbee.in', navi: 'navi.com',
    acko: 'acko.com', digit: 'digit.in', insurancedekho: 'insurancedekho.com', ditto: 'dittoinsurance.com',
    coverfox: 'coverfox.com', sbi: 'sbicard.com', hdfc: 'hdfcbank.com', axis: 'axisbank.com',
    icici: 'icicibank.com', cardinsider: 'cardinsider.com',
  };
  const fallbackImg = merchantDomain[d.merchant_key]
    ? `https://www.google.com/s2/favicons?domain=${merchantDomain[d.merchant_key]}&sz=128`
    : null;
  return {
    merchant_key: d.merchant_key, merchant_name: d.merchant_name, kind: d.kind,
    vertical: (d as any).vertical || MERCHANT_VERTICAL[d.merchant_key] || null,
    title: clip(strip(d.title), 200), description: clip(strip(d.description || ''), 600) || null,
    code: clip(strip((d as any).code || ''), 60) || null,
    discount_text: clip(strip(d.discount_text || ''), 80) || null,
    min_order: null, terms: clip(strip(d.terms || ''), 600) || null,
    dest_url: String(d.dest_url).slice(0, 1000), valid_till: (d as any).valid_till || null,
    sort_weight: d.sort_weight ?? 0, is_active: 1, source: 'auto',
    dedupe_key: d.dedupe_key.slice(0, 180), image_url: d.image_url || fallbackImg,
  };
}

export async function syncAutoDeals(): Promise<ProviderOutcome[]> {
  const providers: Array<{ provider: string; run: () => Promise<AcquiredDeal[]> }> = [
    { provider: 'myntra', run: () => acquireMyntraDeals() },
    { provider: 'tatacliq', run: () => acquireTatacliqDeals() },
    { provider: 'amazon', run: () => acquireAmazonDeals() },
  ];
  const store = getStore();
  const now = new Date();
  const outcomes: ProviderOutcome[] = [];
  // Self-heal: drop rows whose title leaked HTML markup from older extractor versions.
  try {
    await store.execute(`DELETE FROM deals WHERE source='auto' AND (title LIKE '%<%' OR title LIKE '%class=%')`);
  } catch { /* table/column not present in dev file-store: nothing to purge */ }
  for (const p of providers) {
    try {
      const deals = await p.run();
      let saved = 0;
      for (const d of deals) {
        const c = cleanDeal(d);
        if (!c.title || /<|class=|&#/.test(c.title)) continue;   // never store markup in a title
        const ex = await store.query<any>('SELECT id FROM deals WHERE dedupe_key = ?', [c.dedupe_key]);
        if (ex.length) {
          await store.execute(
            'UPDATE deals SET merchant_name=?, kind=?, vertical=?, title=?, description=?, discount_text=?, terms=?, dest_url=?, sort_weight=?, is_active=?, last_seen_at=? WHERE id=?',
            [c.merchant_name, c.kind, c.vertical, c.title, c.description, c.discount_text, c.terms, c.dest_url, c.sort_weight, 1, now, ex[0].id]);
        } else {
          await store.execute(
            `INSERT INTO deals (merchant_key, merchant_name, kind, vertical, title, description, code, discount_text, min_order, terms, dest_url, valid_till, sort_weight, is_active, source, dedupe_key, image_url, last_seen_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [c.merchant_key, c.merchant_name, c.kind, c.vertical, c.title, c.description, c.code, c.discount_text, c.min_order, c.terms, c.dest_url, c.valid_till, c.sort_weight, c.is_active, c.source, c.dedupe_key, c.image_url, now]);
        }
        saved++;
      }
      outcomes.push({ provider: p.provider, ok: true, deals: saved });
    } catch (e: any) {
      // isolated: one merchant's gate never blocks the others
      outcomes.push({ provider: p.provider, ok: false, deals: 0, error: clip(String(e?.message || e), 160) });
      log.warn('Deals', `Auto sync failed for ${p.provider} (isolated)`, { error: clip(String(e?.message || e), 120) });
    }
  }
  // Retire auto-deals the sources no longer return (3-day quiet period). Done in JS, not
  // NOW()-INTERVAL SQL, so the naive dev file-store cannot misparse the expression and
  // clobber unrelated rows; the same logic is correct on MySQL.
  try {
    const rows = await store.query<any>(`SELECT id, last_seen_at FROM deals WHERE source = 'auto' AND is_active = 1`);
    const cutoff = Date.now() - 3 * 86_400_000;
    for (const r of rows) {
      const seen = Date.parse(String(r.last_seen_at || '').replace(' ', 'T'));
      if (Number.isFinite(seen) && seen < cutoff) {
        await store.execute('UPDATE deals SET is_active = ? WHERE id = ?', [0, Number(r.id)]);
      }
    }
  } catch { /* retirement is best-effort; next sync retries */ }
  log.info('Deals', 'Auto sync complete', { outcomes: JSON.stringify(outcomes) });
  return outcomes;
}
