/**
 * MakeMyTrip DATED hotel listing (server-rendered).
 *
 * HISTORY, so nobody re-breaks it: this source was reported "gated" for days because the probe asked for
 * `city=CTIXE` while searching Indore. IXE is MANGALORE's airport code, so MakeMyTrip correctly served
 * Mangalore hotels - the earlier conclusion ("MMT sends the wrong city") was my own wrong city code, not an
 * edge block. MakeMyTrip's hotel city code is `CT` + the IATA airport code (Indore CTIDR, Mumbai CTBOM,
 * Delhi CTDEL), which server/common/airportLookup already maps.
 *
 * The dated listing page is React-rendered, so the plain Akamai edge answers a 6-byte stub. Rendered through
 * the rescue ladder (ScraperAPI render) it returns ~685KB with 60+ real cards, its own rupee prices, taxes
 * and fees, and the requested stay (21-22 Nov 2026) baked into the request. Every card carries:
 *   <p class="latoBlack ... font20 ...">Hotel name</p>
 *   <p class="priceText latoBlack ..." id="hlistpg_hotel_shown_price">₹ 5,500</p>
 *   <p class="font14 midGreyText">+ ₹ 275 taxes &amp; fees</p>
 *   https://www.makemytrip.com/hotels/<slug>-details-<city>.html
 * Earlier JSON-LD ItemList on the same page carries only 5 hotels, so the DOM is the source of truth here.
 */
import { IATA } from '../../common/airportLookup';

export interface MmtListingRow {
  name: string;
  /** Room price as printed on the card. */
  price: number;
  /** Taxes and fees printed right under the price (0 when absent). */
  taxes: number;
  /** price + taxes: what the guest actually pays for the stay's cheapest room. */
  total: number;
  star: number | null;
  url: string | null;
}

/** MakeMyTrip's hotel city code = `CT` + IATA. Returns null when the city has no airport code we know. */
export function mmtCityCode(city: string): string | null {
  const key = String(city || '').toLowerCase().trim();
  if (!key) return null;
  const code = (IATA as Record<string, string>)[key];
  if (!code || code.length !== 3) return null;
  return `CT${code.toUpperCase()}`;
}

/**
 * MakeMyTrip's listing URL takes the stay as MMDDYYYY, not DDMMYYYY: the verified working request was
 * checkin=11212026 / checkout=11222026 for 21-22 Nov 2026 (as DDMMYYYY the month would be 21, which parse
 * cannot produce), and the rendered page carries exactly those two strings.
 */
const mmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[2]}${m[3]}${m[1]}` : '';
};

/** The dated listing URL. Without a code (unknown city) returns null: a wrong city is worse than no row. */
export function mmtListingUrl(city: string, checkin: string, checkout: string): string | null {
  const code = mmtCityCode(city);
  const ci = mmtDate(checkin);
  const co = mmtDate(checkout);
  if (!code || !ci || !co) return null;
  return `https://www.makemytrip.com/hotels/hotel-listing/?checkin=${ci}&checkout=${co}&city=${code}`
    + `&country=IN&locusId=${code}&locusType=city&roomStayQualifier=2e0e`;
}

const num = (raw: string | undefined): number => {
  const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const stripTags = (s: string): string =>
  s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Parse the rendered listing. Cards are split on the `listingRow` container so a price can never be attached
 * to the wrong hotel; a card without both a name and a positive printed price is dropped (No Price, No Card).
 */
export function parseMmtHotelListing(html: string): MmtListingRow[] {
  const body = String(html || '');
  if (body.length < 5000) return [];
  const out: MmtListingRow[] = [];
  const seen = new Set<string>();
  const starts: number[] = [];
  const marker = /<div[^>]*class="[^"]*\blistingRow\b[^"]*"/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(body))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const card = body.slice(starts[i], starts[i + 1] ?? Math.min(body.length, starts[i] + 60_000));
    // A card can carry more than one latoBlack/font20 paragraph (MakeMyTrip's "Spotlight" tooltip is one),
    // so take the first candidate that reads like a hotel name instead of blind-first.
    const candidates = Array.from(card.matchAll(/<p[^>]*class="[^"]*\blatoBlack\b[^"]*\bfont20\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g))
      .map((mm) => stripTags(mm[1] || ''));
    const name = candidates.find((t) => t.length >= 3 && t.length <= 90
      && !/property is part of|spotlight program|advertisement fee|taxes & fees/i.test(t)) || '';
    const shown = /id="hlistpg_hotel_shown_price"[^>]*>\s*(?:₹|&#8377;|Rs\.?)\s*([\d,]+)/.exec(card);
    if (!name || !shown) continue;
    const price = num(shown[1]);
    if (!price) continue;
    const taxes = num((/\+\s*(?:₹|&#8377;|Rs\.?)\s*([\d,]+)\s*taxes/i.exec(card) || [])[1]) || 0;
    const starRaw = num((/\b([1-5](?:\.\d)?)\s*[- ]?star/i.exec(stripTags(card).slice(0, 400)) || [])[1]);
    const url = (/https:\/\/www\.makemytrip\.com\/hotels\/[a-z0-9_%-]+-details-[a-z0-9-]+\.html/i.exec(card) || [])[0] || null;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, price, taxes, total: price + taxes, star: starRaw || null, url });
  }
  return out;
}

/** True when the rendered page belongs to the requested stay, so stamping the date is not a guess. */
export function mmtPageMatchesStay(html: string, checkin: string, checkout: string): boolean {
  const ci = mmtDate(checkin);
  const co = mmtDate(checkout);
  const body = String(html || '');
  if (!ci || !co || body.length < 5000) return false;
  return body.includes(ci) && body.includes(co);
}
