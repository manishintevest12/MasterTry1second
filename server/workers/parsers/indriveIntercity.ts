/**
 * InDrive intercity (India) parser.
 *
 * InDrive's intercity web app (intercity.indrive.com) talks to an open guest
 * API gateway (ic3-gw-cf.euce1.indriverapp.com, exposed in the app's
 * Next.js runtimeConfig as NEXT_PUBLIC_HOST_API):
 *   GET /web/v1/cities?search=<q>&country_id=14   -> city registry (id, name, INR)
 *   GET /web/v1/prices?city_from_id=X&city_to_id=Y -> published price ranges
 *     [{"min_price":1600,"max_price":5600,"order_type":"private"}, ...]
 * No auth, no WAF. InDrive rides are passenger-name-your-price, so the range
 * is InDrive's own published indicative band, never a fixed fare — labelled.
 */
import { newRawItem } from '../../sources/contract';
import { cffiFetch } from '../../common/curlCffiFetch';
import { AcquisitionError } from '../../common/httpClient';

const HOST_API = 'https://ic3-gw-cf.euce1.indriverapp.com';
const WEB = 'https://intercity.indrive.com/';
const INDIA_COUNTRY_ID = 14;
const HEADERS = {
  Accept: 'application/json',
  Origin: 'https://intercity.indrive.com',
  Referer: 'https://intercity.indrive.com/',
  'Accept-Language': 'en-IN,en;q=0.9',
};

export interface InDriveCity { id: number; name: string; sub_name?: string; currency_code?: string }
interface PriceRow { min_price: number; max_price: number; order_type: string }

/** Search InDrive's city registry; best token-match wins (exact name first). */
export async function indriveCityLookup(term: string): Promise<InDriveCity | null> {
  const q = term.trim().replace(/\s+/g, ' ');
  if (q.length < 2) return null;
  const url = `${HOST_API}/web/v1/cities?search=${encodeURIComponent(q)}&country_id=${INDIA_COUNTRY_ID}`;
  const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 15_000, headers: HEADERS });
  if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `InDrive city search HTTP ${r.status}`, r.status);
  let cities: InDriveCity[];
  try { cities = JSON.parse(r.body || '[]'); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'InDrive city search non-JSON'); }
  if (!Array.isArray(cities) || !cities.length) return null;
  // Rank: exact name, then a word-boundary prefix, then substring (owner bug 16 Oct:
  // search "bhopal" picked "Bhopalgarh" because it appeared first in the list).
  const pick = indrivePickCity(cities, q);
  return pick || cities[0];
}

/** Pure ranking helper (unit-tested): exact == prefix(word-boundary) == substring == null. */
export function indrivePickCity(cities: InDriveCity[], q: string): InDriveCity | null {
  const t = q.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!t) return null;
  const norm = (s: string) => String(s).toLowerCase().replace(/\s+/g, ' ');
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`^${esc}\\b`);
  return cities.find((c) => norm(c.name) === t)
    || cities.find((c) => rx.test(norm(c.name)))
    || cities.find((c) => norm(c.name).includes(t))
    || null;
}

/** Fetch InDrive's published intercity price bands for a city pair. */
export async function indrivePrices(fromId: number, toId: number): Promise<PriceRow[]> {
  const url = `${HOST_API}/web/v1/prices?city_from_id=${fromId}&city_to_id=${toId}`;
  const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 15_000, headers: HEADERS });
  if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `InDrive prices HTTP ${r.status}`, r.status);
  let rows: PriceRow[];
  try { rows = JSON.parse(r.body || '[]'); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'InDrive prices non-JSON'); }
  return Array.isArray(rows) ? rows : [];
}

const ORDER_LABELS: Record<string, string> = {
  private: 'private car',
  pool: 'pool',
  // "parcel" is package delivery, not a passenger ride — never emitted
};

export interface IndriveOfferItem { from: InDriveCity; to: InDriveCity; row: PriceRow }

/** Turn a city pair's price rows into offer items (private + pool only). */
export function buildIndriveOffers(
  source: any, fromCity: string, toCity: string, from: InDriveCity, to: InDriveCity, rows: PriceRow[],
): any[] {
  const today = new Date().toISOString().slice(0, 10);
  const items: any[] = [];
  for (const row of rows) {
    const vehicle = ORDER_LABELS[row.order_type];
    if (!vehicle || !Number(row.min_price)) continue;
    const rangeNote = row.max_price > row.min_price
      ? `published range ₹${row.min_price}–₹${row.max_price}`
      : `published price ₹${row.min_price}`;
    items.push(newRawItem(source, {
      title: `${fromCity} to ${toCity} cab (InDrive Intercity, ${vehicle}, one-way)`,
      brand: 'InDrive',
      price: Math.round(Number(row.min_price)), currency: 'INR',
      seller: 'InDrive',
      travel: { route: `${fromCity} to ${toCity}`.toLowerCase(), seatType: vehicle === 'pool' ? 'shared' : 'unknown' },
      attributes: {
        pickup: fromCity, drop: toCity, route: `${fromCity} to ${toCity}`,
        vehicle_type: `InDrive Intercity (${vehicle})`, trip_type: 'one-way',
        price_basis: `InDrive's own published intercity ${rangeNote} for ${from.name} → ${to.name}, retrieved ${today}`,
        data_note: `InDrive rides are passenger-name-your-price; this is InDrive's published indicative band from its intercity web app (guest API), not a fixed fare. City pair resolved via InDrive's own city registry: ${from.name} (id ${from.id}) → ${to.name} (id ${to.id}).`,
      },
      sellerUrl: WEB,
      identifiers: { sku: `indrive-ic-${from.id}-${to.id}-${row.order_type}` },
      evidence: { sourceUrl: `${HOST_API}/web/v1/prices?city_from_id=${from.id}&city_to_id=${to.id}`, extractedFields: ['min_price', 'max_price', 'order_type'] },
    }));
  }
  return items.sort((a, b) => a.price - b.price);
}
