/**
 * MakeMyTrip bus parser (owner 28 Oct: "inko add kro aur price le kr bhi aao inke").
 *
 * The old w_bus_makemytrip worker was a probe that assumed MMT serves only an empty JS shell.
 * Browserless recon found the opposite: the bus SPA talks to a public Apollo endpoint
 * `POST https://bus.makemytrip.com/graphql` (operation BusListing), and city ids come from
 * `GET https://ground-auto-suggest.makemytrip.com/api/v1/bus/autosuggest/search?query=<city>`.
 * Both are plain HTTPS JSON — no session, no cookie, no API key — and they answer from the
 * production host. The query below is the exact document MMT's own bundle sends, trimmed to
 * the fields a comparison row needs (full doc: 1.07MB / 2.6s, trimmed: 134KB / 2.1s).
 *
 * Response shape (verified live 28 Oct, Indore->Bhopal):
 *   { data: { search: { status: 'SUCCESS', data: { buses: [ {
 *     tripKey, operatorName,
 *     availability { totalSeatsLeft },
 *     attributes { isSleeper, isAc, type },
 *     journeyInfo { departureTimeStamp, arrivalTimeStamp, journeyTimeInMinutes },
 *     fareDetails { minPrice, maxPrice, displayPrice },
 *     extraInfo { overallRating, ratings },
 *     operatorConfig { serviceId, shortName } } ] } } } }
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const MMT_GRAPHQL_URL = 'https://bus.makemytrip.com/graphql';
export const MMT_AUTOSUGGEST_URL = 'https://ground-auto-suggest.makemytrip.com/api/v1/bus/autosuggest/search';

export const MMT_BUS_LISTING_QUERY = `query BusListing($req: SearchRequest!) {
  search(request: $req) {
    status
    data {
      buses {
        tripKey
        operatorName
        availability { totalSeatsLeft }
        attributes { isSleeper isAc type }
        journeyInfo { departureTimeStamp arrivalTimeStamp journeyTimeInMinutes }
        fareDetails { minPrice maxPrice displayPrice }
        extraInfo { overallRating ratings }
        operatorConfig { serviceId shortName }
      }
    }
  }
}`;

/** MMT wants DD-MM-YYYY (their own bundle formats with `E(date, "DD-MM-YYYY")`). */
export function mmtDate(iso: string): string {
  const d = String(iso || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export function mmtBusRequest(fromCode: string, toCode: string, isoDate: string, supportAltRoutes = true) {
  return {
    query: MMT_BUS_LISTING_QUERY,
    operationName: 'BusListing',
    variables: { req: { from: fromCode, to: toCode, date: mmtDate(isoDate), flags: { supportAltRoutes } } },
  };
}

/** First real city suggestion from MMT's own autosuggest (areas/localities are ignored). */
export function parseMmtCitySuggestion(json: any, city: string): { code: string; name: string } | null {
  const rows = json?.data?.r;
  if (!Array.isArray(rows)) return null;
  const wanted = String(city || '').trim().toLowerCase();
  const cities = rows.filter((r: any) => r && r.t === 'city' && typeof r._id === 'string');
  const exact = cities.find((r: any) => String(r.n || '').trim().toLowerCase() === wanted);
  const pick = exact || cities[0];
  return pick ? { code: String(pick._id), name: String(pick.n || city) } : null;
}

/** epoch seconds -> 'HH:MM' in IST (the times MMT prints on its own results page). */
export function istTime(epochSeconds: number): string {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return '';
  const shifted = new Date((epochSeconds + 19_800) * 1000); // +5:30
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function mmtBusType(a: any): string {
  const type = String(a?.attributes?.type || '').trim();
  if (type) return type;
  const parts = [a?.attributes?.isAc ? 'AC' : 'Non AC', a?.attributes?.isSleeper ? 'Sleeper' : 'Seater'];
  return parts.join(' ');
}

export interface MmtParseResult {
  items: RawSourceItem[];
  busCount: number;
  status: string;
  reason?: string;
}

export function parseMmtBusListing(
  json: any,
  source: SourceConfig,
  deeplinkUrl: string,
  from: string,
  to: string,
  depart: string,
  maxRows = 14,
): MmtParseResult {
  const search = json?.data?.search;
  const status = String(search?.status || (Array.isArray(json?.errors) && json.errors.length ? 'ERROR' : ''));
  const buses = search?.data?.buses;
  if (!Array.isArray(buses) || !buses.length) {
    const firstError = Array.isArray(json?.errors) && json.errors.length ? String(json.errors[0]?.message || '') : '';
    return {
      items: [], busCount: 0, status,
      reason: firstError ? `MMT GraphQL error: ${firstError}` : `no services returned for ${from} to ${to} on ${depart}`,
    };
  }
  const route = `${from} to ${to}`.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Array<{ item: RawSourceItem; price: number; key: string }> = [];
  for (const b of buses) {
    // MMT sometimes returns fractional rupees (329.20001220703125): a fare is shown in whole rupees.
    const price = Math.round(Number(b?.fareDetails?.displayPrice ?? b?.fareDetails?.minPrice));
    if (!Number.isFinite(price) || price <= 0) continue;
    const operator = String(b?.operatorName || b?.operatorConfig?.shortName || 'MMT operator').trim();
    const dep = istTime(Number(b?.journeyInfo?.departureTimeStamp));
    const arr = istTime(Number(b?.journeyInfo?.arrivalTimeStamp));
    const durMin = Number(b?.journeyInfo?.journeyTimeInMinutes) || 0;
    const overnight = dep && arr && arr < dep;
    const departureLabel = dep ? `${dep}${arr ? ` \u2192 ${arr}${overnight ? ' (+1)' : ''}` : ''}` : '';
    const key = String(b?.tripKey || b?.operatorConfig?.serviceId || `${operator}-${dep}-${price}`);
    const seats = Number(b?.availability?.totalSeatsLeft);
    rows.push({
      price, key,
      item: newRawItem(source, {
        title: `${operator} ${from} to ${to} bus (${dep || 'departure'}${arr ? ` - ${arr}` : ''})`,
        brand: operator,
        price,
        currency: 'INR',
        seller: 'makemytrip',
        sellerUrl: deeplinkUrl,
        travel: { route, date: depart || undefined, seatType: mmtBusType(b) },
        attributes: {
          route,
          operator,
          bus_type: mmtBusType(b),
          departure: departureLabel,
          departure_time: dep,
          arrival_time: arr,
          ...(durMin > 0 ? { duration: `${Math.floor(durMin / 60)}h ${durMin % 60}m`, duration_minutes: String(durMin) } : {}),
          ...(Number.isFinite(seats) ? { seats_available: String(seats) } : {}),
          ...(b?.extraInfo?.overallRating ? { rating: String(b.extraInfo.overallRating) } : {}),
          ...(b?.extraInfo?.ratings ? { ratings_count: String(b.extraInfo.ratings) } : {}),
          ...(Number.isFinite(Number(b?.fareDetails?.maxPrice)) ? { max_fare: String(b.fareDetails.maxPrice) } : {}),
          journey_date: String(depart || ''),
          price_basis: `per-service fare as published by makemytrip.com for ${depart || 'the requested date'}`,
          data_note: `MakeMyTrip bus service fare scraped from bus.makemytrip.com on ${today}`,
        },
        identifiers: { sku: `mmt-bus-${route.replace(/\s+/g, '-')}-${key}`.slice(0, 90) },
        evidence: { sourceUrl: deeplinkUrl, extractedFields: ['data.search.data.buses[].fareDetails', 'operatorName', 'journeyInfo', 'availability'] },
      }),
    });
  }
  // Cheapest first, one row per service; cap keeps the comparison readable.
  rows.sort((a, b) => a.price - b.price);
  const seen = new Set<string>();
  const items: RawSourceItem[] = [];
  for (const r of rows) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    items.push(r.item);
    if (items.length >= maxRows) break;
  }
  return { items, busCount: buses.length, status };
}

/** MMT's own results route for this search (used as the row's honest deeplink). */
export function mmtBusDeeplink(from: string, to: string, isoDate: string): string {
  const cap = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return `https://www.makemytrip.com/bus/search/${encodeURIComponent(cap(from))}/${encodeURIComponent(cap(to))}/${mmtDate(isoDate)}`;
}
