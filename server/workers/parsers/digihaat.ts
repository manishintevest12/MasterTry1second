/**
 * DigiHaat (digihaat.in) parser — the owner's Cuelinks partner store
 * ("digihaat.in bhi add karo ecommerce, food aur others me", 17 Nov 2026).
 *
 * DigiHaat is an ONDC buyer app: one search spans many seller apps (mydailygoods, fynd, addble …),
 * so a single query returns comparable real prices across kirana/food/decor sellers.
 *
 * MEASURED live 17 Nov 2026:
 *  - The site is a Next.js client-rendered shell: the search page HTML carries no products at all
 *    (verified: 73 KB of markup, zero price nodes), so an HTML scrape can never work here.
 *  - Under it sits a JSON API: GET prod.digihaat.in/clientApis/v3/search/global/items
 *    ?latitude&longitude&pincode&name&isManualSearch&pageNumber&limit  (found by rendering the
 *    page in Chromium and capturing XHRs).
 *  - That API refuses unauthenticated calls (401 INVALID_TOKEN). It accepts the site's own GUEST
 *    token: GET https://digihaat.in/en sets a `guestToken` cookie (a 30-day RS256 JWT, isGuest:true)
 *    which the very same request carries as `Authorization: Bearer …`. No account, no login, no
 *    CAPTCHA — the same call the public web app makes for an anonymous visitor.
 *  - Response shape: { count, data: [ { item_details: { descriptor{name,images,long_desc}, price{value,
 *    currency,maximum_value}, quantity{unitized{measure{unit,value}}} }, provider_details{descriptor{name}},
 *    location_details{address{city,state},gps}, fulfillment[] } ] }
 *
 * Honesty: only priced items with a real name are emitted. Nothing is invented — no ratings, no
 * discounts, no stock claims beyond what the API states.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { cffiFetch } from '../../common/curlCffiFetch';

const SITE = 'https://digihaat.in';
const API = 'https://prod.digihaat.in/clientApis/v3/search/global/items';

/** Guest JWT cache: minting costs one HTML fetch, so reuse it while it is comfortably valid. */
let guestToken: string | null = null;
let guestTokenAt = 0;
const GUEST_TTL_MS = 20 * 60_000;

export function digihaatSearchUrl(term: string): string {
  return `${SITE}/en/search?q=${encodeURIComponent(term)}`;
}

/** Mint (or reuse) the anonymous guest token the public web app uses. */
async function getGuestToken(force = false): Promise<string> {
  if (!force && guestToken && Date.now() - guestTokenAt < GUEST_TTL_MS) return guestToken;
  const r = await cffiFetch(`${SITE}/en`, {
    impersonate: 'chrome',
    timeoutMs: 25_000,
    returnCookies: true,
    headers: { 'Accept-Language': 'en-IN,en;q=0.9' },
  });
  const tok = r.cookies?.guestToken || '';
  if (r.status !== 200 || tok.length < 40) {
    throw new Error(`DigiHaat guest session unavailable (HTTP ${r.status}, token ${tok ? 'short' : 'missing'})`);
  }
  guestToken = tok;
  guestTokenAt = Date.now();
  return tok;
}

export interface DigiHaatPlace { lat: number; lng: number; pincode: string }

/** Indore defaults (the owner's own city) when the query carries no location. */
const DEFAULT_PLACE: DigiHaatPlace = { lat: 22.7203616, lng: 75.8681996, pincode: '452001' };

export function digihaatPlace(loc?: { lat?: number; lng?: number; pincode?: string }): DigiHaatPlace {
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  const pin = String(loc?.pincode || '');
  return {
    lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : DEFAULT_PLACE.lat,
    lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : DEFAULT_PLACE.lng,
    pincode: /^\d{6}$/.test(pin) ? pin : DEFAULT_PLACE.pincode,
  };
}

/** Live search. Returns the parsed body; throws on a hard refusal so the worker reports honestly. */
export async function fetchDigihaat(term: string, place: DigiHaatPlace, limit = 20): Promise<string> {
  const q = String(term || '').trim();
  if (!q) return '{"data":[]}';
  const call = async (token: string) => {
    const url =
      `${API}?latitude=${place.lat}&longitude=${place.lng}&pincode=${encodeURIComponent(place.pincode)}` +
      `&name=${encodeURIComponent(q)}&isManualSearch=true&pageNumber=1&limit=${Math.max(1, Math.min(40, limit))}`;
    return cffiFetch(url, {
      impersonate: 'chrome',
      timeoutMs: 20_000,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: SITE,
        Referer: `${SITE}/en/search?q=${encodeURIComponent(q)}`,
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
  };
  let r = await call(await getGuestToken());
  // An expired/invalidated token is the one recoverable failure: mint a fresh guest session once.
  if (r.status === 401) r = await call(await getGuestToken(true));
  if (r.status !== 200) throw new Error(`DigiHaat search HTTP ${r.status}`);
  return r.body;
}

function unitLabel(measure: any): string {
  const unit = String(measure?.unit || '').trim();
  const value = String(measure?.value || '').trim();
  if (!unit && !value) return '';
  if (!value) return unit;
  return `${value} ${unit}`.replace(/\s+/g, ' ').trim();
}

/** Pure parser: DigiHaat search JSON -> raw items (priced, named items only). */
export function parseDigihaat(body: string, source: SourceConfig, requestUrl: string): RawSourceItem[] {
  let root: any;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  const rows: any[] = Array.isArray(root?.data) ? root.data : [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const item = row?.item_details || {};
    const desc = item?.descriptor || {};
    const name = String(desc.name || '').replace(/\s+/g, ' ').trim();
    const priceRaw = Number(item?.price?.value);
    const currency = String(item?.price?.currency || 'INR').toUpperCase();
    if (!name || !Number.isFinite(priceRaw) || priceRaw <= 0) continue;
    const seller = String(row?.provider_details?.descriptor?.name || 'DigiHaat seller').replace(/\s+/g, ' ').trim();
    const sku = String(row?.id || item?.id || `${seller}-${name}`).slice(0, 120);
    const key = `${sku}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const images: string[] = Array.isArray(desc.images) ? desc.images.filter((u: any) => typeof u === 'string' && /^https?:\/\//.test(u)) : [];
    const unit = unitLabel(item?.quantity?.unitized?.measure);
    const maxValue = Number(item?.price?.maximum_value);
    const city = String(row?.location_details?.address?.city || '').trim();
    const available = Number(item?.quantity?.available?.count);
    out.push(
      newRawItem(source, {
        title: (unit && name.toLowerCase().indexOf(unit.toLowerCase()) === -1 ? `${name} (${unit})` : name).slice(0, 200),
        price: Math.round(priceRaw * 100) / 100,
        listPrice: Number.isFinite(maxValue) && maxValue > priceRaw ? Math.round(maxValue * 100) / 100 : undefined,
        currency: currency === 'INR' ? 'INR' : currency,
        seller,
        sellerUrl: digihaatSearchUrl(name),
        identifiers: { vendorProductId: sku },
        availability: Number.isFinite(available) ? (available > 0 ? 'in_stock' : 'out_of_stock') : 'unknown',
        attributes: {
          image: images[0] || '',
          ...(images.length > 1 ? { image_urls: images.slice(0, 6).join('|') } : {}),
          platform: 'DigiHaat',
          ...(unit ? { pack_size: unit } : {}),
          ...(city ? { seller_city: city } : {}),
          data_note: 'Live DigiHaat (ONDC) listing — price and seller as published by the seller app.',
        },
        evidence: {
          sourceUrl: requestUrl,
          extractedFields: ['title', 'price', 'seller', 'image'],
          sourceReference: 'DigiHaat clientApis v3 global item search (guest session, public web app call)',
        },
      }),
    );
  }
  return out;
}
