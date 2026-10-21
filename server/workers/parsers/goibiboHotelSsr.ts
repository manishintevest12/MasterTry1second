/**
 * Goibibo hotel SRP parser — window.__initial_state__ walker (21 Oct 2026).
 *
 * www.goibibo.com/hotels/hotels-in-<city>[-ct]/ serves a Gatsby-style SSR page
 * whose full hotel listing state lives in `window.__initial_state__` (NOT
 * __NEXT_DATA__). Verified live browserless with curl_cffi + full Chrome
 * headers (sec-ch-ua/sec-fetch set): 1.3MB page, 20 hotels with real nightly
 * prices (Ginger Goa, Candolim ₹5,899 + ₹294 tax), images, ratings, deeplinks.
 * Akamai SAMPLES this path from datacenter IPs (~alternating 8-byte
 * "200 - OK" stubs), so callers retry — the big page usually lands within a
 * few attempts.
 *
 * The state blob is JS, not strict JSON: it contains `new Date("...")` and
 * `:undefined` literals and trailing statements, so extract balanced braces,
 * sanitize, then parse. Hotels live at
 *   srpUnif.srpData.personalizedSections.RECOMMENDED_HOTELS.hotels[]
 * with priceDetail.price / discountedPrice (per night, tax-exclusive),
 * totalTax, priceWithTax, reviewSummaryUgc ratings, media[].url images and
 * detailDeeplinkUrl / seoUrl redirects. Prices are for the page's OWN service
 * dates (common.checkin/checkout, surfaced for honest labelling).
 */
import type { ParsedGoibiboHotel } from './goibiboHotels';

export interface GoibiboHotelSsrState {
  rows: ParsedGoibiboHotel[];
  /** The page's own service dates (ISO), for honest offer labels. */
  checkIn?: string;
  checkOut?: string;
  hotelCount?: number;
}

/** Extract + sanitize + JSON.parse window.__initial_state__ from an SSR page. */
export function extractInitialState(body: string): any | null {
  const marker = 'window.__initial_state__=';
  const start = body.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  while (i < body.length && /\s/.test(body[i])) i++;
  if (body[i] !== '{') return null;
  const objStart = i; // fixed: the scan loop below advances i
  // balanced-brace scan respecting strings and escapes
  let depth = 0, inStr = false, esc = false, end = -1;
  for (; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  let raw = body.slice(objStart, end + 1);
  // JS literals -> JSON
  raw = raw.replace(/new Date\("([^"]*)"\)/g, '"$1"');
  raw = raw.replace(/:undefined/g, ':null');
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function firstUrl(h: any): string {
  const u = h?.detailDeeplinkUrl || h?.seoUrl || h?.sharingUrl || '';
  return String(u || '');
}

/** Parse hotels out of the __initial_state__ object (shape-tolerant). */
export function parseGoibiboHotelSsrState(body: string): GoibiboHotelSsrState {
  const d = extractInitialState(body);
  if (!d) return { rows: [] };
  const out: GoibiboHotelSsrState = { rows: [] };

  // the page's own service dates (honest labelling)
  const ci = d?.common?.checkin?.date, co = d?.common?.checkout?.date;
  if (typeof ci === 'string') out.checkIn = ci.slice(0, 10);
  if (typeof co === 'string') out.checkOut = co.slice(0, 10);

  const hc = d?.srpUnif?.srpData?.hotelCount;
  if (Number.isFinite(Number(hc))) out.hotelCount = Number(hc);

  const sections = d?.srpUnif?.srpData?.personalizedSections || {};
  const seen = new Set<string>();
  const pushHotel = (h: any) => {
    if (!h || typeof h !== 'object') return;
    const name = String(h.name || h.maskedName || '').trim();
    const pd = h.priceDetail || {};
    let price = Number(pd.discountedPrice ?? pd.price ?? 0) || 0;
    if (!price) price = Number(pd.discountedPriceWithTax ?? pd.priceWithTax ?? 0) || 0;
    if (!name || !Number.isFinite(price) || price < 100 || price > 10_000_000) return;
    if (h.soldOut === true || h.showCallToBook === true) return; // honest: nothing bookable/priced
    const key = name.toLowerCase() + '|' + Math.round(price);
    if (seen.has(key)) return;
    seen.add(key);
    let image = '';
    if (Array.isArray(h.media) && h.media[0]?.url) {
      const mu = String(h.media[0].url);
      image = mu.startsWith('//') ? `https:${mu}` : mu;
    }
    let rating: number | undefined;
    const rs = h?.reviewSummaryUgc;
    if (rs) {
      const rv = Number(rs?.hotelRating ?? rs?.rating ?? rs?.overallRating ?? rs?.avgRating);
      if (Number.isFinite(rv) && rv > 0) rating = Math.round(rv * 10) / 10;
    }
    const loc = Array.isArray(h.locationPersuasion) ? String(h.locationPersuasion[0] || '') : String(h?.locationDetail?.name || '');
    out.rows.push({
      name,
      price,
      rating,
      image,
      locality: loc,
      url: firstUrl(h),
    });
  };

  for (const key of Object.keys(sections)) {
    const sec = sections[key];
    const list = Array.isArray(sec?.hotels) ? sec.hotels : Array.isArray(sec?.hotelInfoList) ? sec.hotelInfoList : null;
    if (list) for (const h of list) pushHotel(h);
  }
  // fallback tolerant scan: any array of objects with name + priceDetail on the srp state
  if (!out.rows.length) {
    const scan = (o: any, depth = 0) => {
      if (!o || typeof o !== 'object' || depth > 6) return;
      if (Array.isArray(o)) { for (const x of o) { if (x?.priceDetail && x?.name) pushHotel(x); else scan(x, depth + 1); } return; }
      for (const v of Object.values(o)) scan(v, depth + 1);
    };
    scan(d?.srpUnif?.srpData);
  }
  return out;
}
