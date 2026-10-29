/**
 * redBus searchResults parser (bus vertical, India).
 *
 * Reverse-engineered from www.redbus.in's own SRP webpack bundle (indSearch):
 *   GET  /rpw/api/citySuggestion?search=<city>&limit=3   -> {response:{docs:[{ID,Name,locationType}]}}
 *   POST /rpw/api/searchResults?fromCity=ID&toCity=ID&DOJ=YYYY-MM-DD&limit=..&offset=0&sort=0&sortOrder=0&from=web&meta=false&bT=1&getUuid=false
 *        body {}                                        -> {data:{inventories:[{travelsName,busType,fareList,departureTime,arrivalTime,...}]}}
 *
 * Every inventory carries the REAL fare list (fareList[] = per-seat-type fares,
 * min() is the starting fare), timings, live seat counts and operator rating.
 * Nothing is estimated — unparsable services are skipped, never guessed.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface RedBusRoute {
  fromName: string; fromId: number;
  toName: string; toId: number;
  doj: string; // YYYY-MM-DD
}

/** Resolve a city name to redBus's numeric city id via the public Solr-backed suggestion API. */
export function resolveRedBusCity(docs: any[], city: string): { id: number; name: string } | null {
  if (!Array.isArray(docs) || !docs.length) return null;
  // Grouped Solr response: groups may inline the city doc or nest it under doclist.docs
  const flat: any[] = [];
  for (const g of docs) {
    if (g?.doclist?.docs) flat.push(...g.doclist.docs);
    else flat.push(g);
  }
  const lower = String(city || '').toLowerCase();
  const cities = flat.filter((d: any) => String(d?.locationType || '').toUpperCase() === 'CITY' && Number(d?.ID) > 0);
  const pool = cities.length ? cities : flat.filter((d: any) => Number(d?.ID) > 0);
  const exact = pool.find((d: any) => String(d?.Name || '').toLowerCase() === lower);
  const chosen = exact || pool[0];
  return chosen ? { id: Number(chosen.ID), name: String(chosen.Name || city) } : null;
}

export function parseRedBusSearch(
  json: string,
  source: SourceConfig,
  route: RedBusRoute,
): RawSourceItem[] {
  let d: any;
  try { d = JSON.parse(json); } catch { return []; }
  const inventories: any[] = Array.isArray(d?.data?.inventories) ? d.data.inventories : [];
  if (!inventories.length) return [];
  const fingerprint = createHash('sha256').update(json.slice(0, 50000)).digest('hex');
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
  const searchUrl = `https://www.redbus.in/bus-tickets/${slug(route.fromName)}-to-${slug(route.toName)}.aspx`;
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const inv of inventories) {
    const fares: number[] = Array.isArray(inv?.fareList) ? (inv.fareList as unknown[]).map(Number).filter((f: number) => f > 0) : [];
    if (!fares.length) continue; // no real fare -> skip, never guess
    const fare = Math.min(...fares);
    const key = `${inv.serviceId}|${inv.routeId}|${inv.travelsName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const operator = String(inv.travelsName || '').trim() || 'redBus operator';
    const busType = String(inv.busType || '').trim();
    const seats = Number(inv.availableSeats);
    const totalSeats = Number(inv.totalSeats);
    const rating = Number(inv.totalRatings) > 0 ? String(Math.round(Number(inv.totalRatings) * 10) / 10) : undefined;
    const durMin = Number(inv.journeyDurationMin);
    const duration = durMin > 0 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : undefined;
    out.push(newRawItem(source, {
      title: `${operator} · ${busType}`.slice(0, 200),
      price: fare,
      currency: 'INR',
      ...(fares.length > 1 ? { listPrice: Math.max(...fares) } : {}),
      seller: 'redBus',
      sellerUrl: searchUrl,
      availability: seats > 0 ? 'in_stock' : 'out_of_stock',
      travel: { route: `${route.fromName} → ${route.toName}`, date: route.doj, seatType: busType || 'unknown' },
      attributes: {
        operator,
        // ids redBus published for this service: needed to rebuild its seat page at click time.
        ...(inv.serviceId ? { service_id: String(inv.serviceId) } : {}),
        ...(inv.routeId ? { route_id: String(inv.routeId) } : {}),
        ...(inv.departureTime ? { departure: `${inv.departureTime.slice(11, 16)}${inv.arrivalTime ? ` → ${inv.arrivalTime.slice(11, 16)} (+1)` : ''}` } : {}),
        ...(inv.departureTime ? { departure_time: inv.departureTime.slice(11, 16) } : {}),
        ...(duration ? { duration } : {}),
        ...(Number.isFinite(seats) ? { seats_available: String(seats) } : {}),
        ...(Number.isFinite(totalSeats) && totalSeats > 0 ? { total_seats: String(totalSeats) } : {}),
        ...(rating ? { rating, rating_count: String(inv.numberOfReviews || '') } : {}),
        ...(busType ? { bus_type: busType.slice(0, 80) } : {}),
        // Structured facets for the bus filter chips (never invented: every flag
        // comes straight off the redBus inventory object).
        ac: inv.isAc === true || inv.isAc === false ? (inv.isAc ? 'yes' : 'no') : (/non[- ]?a\/?c/i.test(busType) ? 'no' : (/a\/?c|air conditioned/i.test(busType) ? 'yes' : '')),
        sleeper: (inv.isSleeper === true) || /sleeper/i.test(busType) ? 'yes' : (/seater/i.test(busType) ? 'no' : ''),
        seater: inv.isSeater === true ? 'yes' : '',
        ...(inv.isPremium === true ? { premium: 'yes' } : {}),
        ...(String(inv.cancellationPolicy || '').includes(':100:') ? { free_cancellation: 'yes' } : {}),
        ...(inv.isLiveTrackingAvailable === true ? { live_tracking: 'yes' } : {}),
        ...(inv.isMticketEnabled === true ? { mticket: 'yes' } : {}),
        ...(inv.isDirectBus === true ? { direct_bus: 'yes' } : {}),
        ...(Number.isFinite(Number(inv.availableWindowSeats)) ? { window_seats: String(inv.availableWindowSeats) } : {}),
        ...(Array.isArray(inv.amenities) && inv.amenities.length ? { amenities: String(inv.amenities.length) } : {}),
        ...(inv.standardBpName ? { boarding_point: String(inv.standardBpName) } : {}),
        ...(inv.standardDpName ? { dropping_point: String(inv.standardDpName) } : {}),
        platform: 'redBus',
        data_note: 'Live per-service fare and seats from redBus public web API',
      },
      evidence: {
        sourceUrl: searchUrl,
        rawFingerprint: fingerprint,
        extractedFields: ['travelsName', 'busType', 'fareList', 'departureTime', 'arrivalTime', 'availableSeats', 'serviceId', 'routeId'],
      },
    }));
  }
  return out;
}
