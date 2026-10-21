/**
 * MakeMyTrip hotel landing parser — $hotelReducerResponse walker (21 Oct 2026).
 *
 * MMT root-path city landings www.makemytrip.com/hotels-in-<city>/ are OPEN
 * browserless (159KB PWA shell) but carry an EMPTY $hotelReducerResponse {}
 * from gated datacenter IPs. From a clean IP (e.g. production Hostinger,
 * or when Akamai's hotel-path sampling lifts) the same page may SSR-populate
 * the reducer with real hotels + nightly prices. This parser is deliberately
 * shape-tolerant: it locates the $hotelReducerResponse JSON in the page and
 * walks it for hotel-shaped rows (name + per-night price), so the
 * self-detecting w_hotels_mmt probe self-activates the day the gate lifts.
 *
 * The reducer is assigned like: $hotelReducerResponse = {...}; (plain JSON,
 * no sanitization needed for the entries probed so far).
 */
import type { ParsedGoibiboHotel } from './goibiboHotels';

export interface MmtHotelLandingRows {
  rows: ParsedGoibiboHotel[];
  /** True when the reducer exists but is empty (gate held — honest skip). */
  reducerEmpty: boolean;
}

const PRICE_KEYS = ['price', 'priceForOneNight', 'fare', 'minFare', 'cheapestPrice', 'startingPrice', 'basePrice', 'amount', 'nightlyRate'];
const NAME_KEYS = ['name', 'hotelName', 'displayName', 'title', 'propertyName'];
const RATING_KEYS = ['rating', 'starRating', 'userRating', 'avgRating', 'hotelRating'];
const IMG_KEYS = ['image', 'imageUrl', 'thumbUrl', 'heroImage', 'img', 'image_url'];
const LOC_KEYS = ['locality', 'areaName', 'area', 'neighbourhood', 'location'];

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function pickFirst(o: any, keys: string[]): unknown {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export function parseMmtHotelLanding(body: string): MmtHotelLandingRows {
  const marker = '$hotelReducerResponse';
  const out: MmtHotelLandingRows = { rows: [], reducerEmpty: false };
  let i = body.indexOf(marker);
  if (i < 0) return out;
  // try each occurrence (the reducer may be declared more than once)
  while (i >= 0 && !out.rows.length) {
    const eq = body.indexOf('=', i);
    if (eq < 0) break;
    let j = eq + 1;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] !== '{') { i = body.indexOf(marker, eq); continue; }
    const objStart = j; // fixed: the scan loop below advances j
    // balanced-brace scan (strings + escapes respected)
    let depth = 0, inStr = false, esc = false, end = -1;
    for (; j < body.length; j++) {
      const c = body[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) break;
    let red: any;
    try {
      red = JSON.parse(body.slice(objStart, end + 1));
    } catch {
      i = body.indexOf(marker, end);
      continue;
    }
    const hasContent = JSON.stringify(red).length > 50;
    out.reducerEmpty = out.reducerEmpty || !hasContent;
    // shape-tolerant walk for hotel rows with a name + a per-night price
    const seen = new Set<string>();
    const scan = (o: any, depth: number) => {
      if (!o || typeof o !== 'object' || depth > 6) return;
      if (Array.isArray(o)) { for (const x of o) scan(x, depth + 1); return; }
      const name = String(pickFirst(o, NAME_KEYS) || '').trim();
      const price = num(pickFirst(o, PRICE_KEYS));
      if (name && Number.isFinite(price) && price >= 100 && price <= 10_000_000) {
        const key = name.toLowerCase() + '|' + Math.round(price);
        if (!seen.has(key)) {
          seen.add(key);
          let image = String(pickFirst(o, IMG_KEYS) || '');
          if (image.startsWith('//')) image = `https:${image}`;
          const rating = num(pickFirst(o, RATING_KEYS));
          out.rows.push({
            name,
            price,
            rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : undefined,
            image,
            locality: String(pickFirst(o, LOC_KEYS) || ''),
            url: '',
          });
        }
      }
      for (const v of Object.values(o)) scan(v, depth + 1);
    };
    scan(red, 0);
    i = body.indexOf(marker, end);
  }
  return out;
}
