/**
 * Goibibo Hermes hotel-search API parser (hotels vertical).
 *
 * Recipe (captured 21 Oct, StackOverflow reverse-engineering + Akamai edge denial
 * observation): hermes.goibibo.com/hotels/v12/search/data/v3?searchQuery=<json>
 * where searchQuery = {"Companion":{"TA":"1DA"},"Pax":{"A":"2"},"RoomCnt":"1",
 * "City":"<slug>","CheckIn":"YYYYMMDD","CheckOut":"YYYYMMDD"}.
 *
 * Akamai denies/tarpits this host from datacenter IPs (sandbox tarpit, Browserbase
 * "Access Denied") while the HOSTINGER production IP passes other goibibo surfaces
 * (flights SSR serves full __NEXT_DATA__ there). This is a SELF-DETECTING recipe in
 * the MMT-flights pattern: the worker attempts it every search; a clean egress IP
 * activates live hotel fares automatically.
 *
 * The v12 response shape is not publicly stable-documented, so the parser walks the
 * JSON shape-tolerantly: any ARRAY of objects carrying both a hotel-name-ish field
 * and a price-ish field becomes hotel rows. On zero rows the caller surfaces the raw
 * body snippet in its honest error so the next iteration can pin the exact path.
 */
import { newRawItem } from '../../sources/contract';

export interface HermesHotelRow {
  name: string;
  price: number;
  rating?: number;
  image?: string;
  locality?: string;
  url?: string;
}

const NAME_KEYS = ['hotelName', 'hotel_name', 'hn', 'name', 'nm', 'title', 'hotelTitle'];
const PRICE_KEYS = ['fare', 'Fare', 'price', 'Price', 'op', 'Op', 'amount', 'totalToPay', 'totalPrice', 'baseFare', 'minrate', 'minRate', 'Minrate', 'displayPrice', 'discAmount'];
const RATING_KEYS = ['hotelRating', 'rating', 'starRating', 'userRating', 'gr'];
const IMAGE_KEYS = ['hotelImage', 'image', 'img', 'thumbnail', 'hc', 'imageUrl'];
const LOCALITY_KEYS = ['locality', 'area', 'address', 'location', 'hotelLoc'];
const URL_KEYS = ['hotelUrl', 'url', 'deeplink', 'link', 'hotelCodeUrl'];

const pick = (o: Record<string, any>, keys: string[]): any => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

const toPrice = (v: any): number => {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === 'string') {
    // strips currency text: "Rs.4,500/night" -> 4500
    const m = /(\d[\d,]{2,})/.exec(v);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
  }
  if (v && typeof v === 'object') {
    // nested money objects e.g. {fareDetails:{finalRate:4500}} — take the smallest finite number
    let min: number | undefined;
    const walk = (x: any) => {
      if (typeof x === 'number' && Number.isFinite(x) && x > 50 && x < 100_000_00) min = min === undefined ? x : Math.min(min, x);
      else if (x && typeof x === 'object') for (const vv of Object.values(x)) walk(vv);
    };
    walk(v);
    if (min !== undefined) return Math.round(min);
  }
  return 0;
};

const isHotelish = (o: any): o is Record<string, any> => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const name = pick(o, NAME_KEYS);
  if (typeof name !== 'string' || name.trim().length < 3) return false;
  return true;
};

/** Walk any nested JSON collecting hotel-shaped rows with a real price. */
export function collectHermesHotels(node: any, out: HermesHotelRow[], depth = 0): void {
  if (!node || depth > 8 || out.length >= 60) return;
  if (Array.isArray(node)) {
    const candidates = node.filter(isHotelish);
    if (candidates.length >= 3) {
      // A hotel list: every priced member becomes a row
      for (const c of candidates) {
        const price = toPrice(pick(c, PRICE_KEYS) ?? c.pricing ?? c.priceDetails ?? c.fareDetails);
        if (price <= 0) continue; // never guess a fare
        out.push({
          name: String(pick(c, NAME_KEYS)).trim().slice(0, 160),
          price,
          rating: (() => { const r = Number(pick(c, RATING_KEYS)); return Number.isFinite(r) && r > 0 && r <= 5 ? r : undefined; })(),
          image: (() => { const i = pick(c, IMAGE_KEYS); return typeof i === 'string' && /^https?:\/\//.test(i) ? i : undefined; })(),
          locality: (() => { const l = pick(c, LOCALITY_KEYS); return typeof l === 'string' ? l.slice(0, 80) : undefined; })(),
          url: (() => { const u = pick(c, URL_KEYS); return typeof u === 'string' && /^https?:\/\//.test(u) ? u : undefined; })(),
        });
        if (out.length >= 60) return;
      }
      return; // don't recurse into a consumed hotel list
    }
    for (const x of node) collectHermesHotels(x, out, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) collectHermesHotels(v, out, depth + 1);
  }
}

export function parseHermesHotels(body: string, source: any, city: string, checkIn: string, checkOut: string, sourceUrl: string): any[] {
  let json: any;
  try { json = JSON.parse(body); } catch { return []; }
  const rows: HermesHotelRow[] = [];
  collectHermesHotels(json, rows);
  if (!rows.length) return [];
  const seen = new Set<string>();
  const items: any[] = [];
  for (const h of rows) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    items.push(newRawItem(source, {
      title: h.name,
      seller: 'Goibibo',
      sellerUrl: h.url || sourceUrl,
      currency: 'INR',
      price: h.price,
      attributes: {
        ...(h.image ? { image_url: h.image } : {}),
        ...(h.rating !== undefined ? { rating: String(h.rating) } : {}),
        ...(h.locality ? { locality: h.locality } : {}),
        city,
        check_in: checkIn,
        check_out: checkOut,
        price_basis: `per night for 1 room (${checkIn} → ${checkOut}, engine-chosen dates)`,
        data_note: 'Live nightly fares from Goibibo hotel search API (hermes v12)',
      },
      evidence: {
        sourceUrl,
        extractedFields: ['title', 'price', ...(h.rating !== undefined ? ['rating'] : []), ...(h.locality ? ['locality'] : [])],
      },
    }));
  }
  return items.slice(0, 40);
}
