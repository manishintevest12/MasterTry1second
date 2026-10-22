/**
 * AbhiBus services parser (bus vertical, India). AbhiBus's internal JSON API
 * answers plain HTTP:
 *   GET  /wap/SearchStations?s=<city>          -> [{id, label, state_name, pin_code}]
 *   POST /buslist/v3/services                  -> {services: [...], operators: {...}}
 * with body {source, sourceid, destination, destinationid, jdate, prd, filters,
 * isReturnJourney}. Each service carries the REAL fare (fares.fare / offerPrice),
 * timings, bus type, operator, rating and live seat availability. Nothing here
 * is estimated or invented — unparsable services are skipped, not guessed.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface AbhiBusRoute {
  fromName: string; fromId: string;
  toName: string; toId: string;
  jdate: string; // YYYY-MM-DD
}

/** Resolve a city to AbhiBus's numeric station id via /wap/SearchStations?s=. */
export async function resolveAbhiBusCity(
  fetchJson: (url: string) => Promise<any>,
  city: string,
): Promise<{ id: string; label: string } | null> {
  const raw = String(city || '').trim();
  if (!raw) return null;
  const q = encodeURIComponent(raw.replace(/\s+/g, ' ').slice(0, 40));
  const list = await fetchJson(`https://www.abhibus.com/wap/SearchStations?s=${q}`);
  if (!Array.isArray(list) || !list.length) return null;
  const lower = raw.toLowerCase();
  const exact = list.find((s: any) => String(s.label || '').toLowerCase() === lower);
  const chosen = exact || list[0];
  return { id: String(chosen.id), label: String(chosen.label || raw) };
}

export function parseAbhiBusServices(
  json: string,
  source: SourceConfig,
  route: AbhiBusRoute,
): RawSourceItem[] {
  let d: any;
  try { d = JSON.parse(json); } catch { return []; }
  const services: any[] = Array.isArray(d?.services) ? d.services : [];
  if (!services.length) return [];
  const fingerprint = createHash('sha256').update(json.slice(0, 50000)).digest('hex');
  const searchUrl = `https://www.abhibus.com/bus_search/${encodeURIComponent(route.fromName)}/${route.fromId}/${encodeURIComponent(route.toName)}/${route.toId}/${route.jdate}`;
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const s of services) {
    const fare = Number(s?.fares?.offerPrice) || Number(s?.fares?.fare);
    if (!fare || fare <= 0) continue; // no real fare -> skip, never guess
    const key = String(s.serviceKey || s.serviceId || s.masterId || '');
    if (seen.has(key)) continue;
    seen.add(key);
    const operator = String(s.travelerAgentName || '').trim();
    const busType = String(s.busServiceTypeName || s.busTypeName || '').trim();
    const t = s.timings || {};
    const seats = Number(s?.seatStats?.availableSeats);
    const rating = Number(s.rating) > 0 ? String(s.rating) : undefined;
    out.push(newRawItem(source, {
      title: `${operator || 'AbhiBus operator'} · ${busType}`.slice(0, 200),
      price: fare,
      currency: 'INR',
      ...(Number(s?.fares?.fare) > fare ? { listPrice: Number(s.fares.fare) } : {}),
      seller: 'AbhiBus',
      sellerUrl: searchUrl,
      availability: seats > 0 ? 'in_stock' : 'out_of_stock',
      travel: { route: `${route.fromName} → ${route.toName}`, date: route.jdate, seatType: busType || 'unknown' },
      attributes: {
        operator: operator || 'AbhiBus',
        ...(t.startTime ? { departure: `${String(t.startTime)}${t.arriveTime ? ` → ${String(t.arriveTime)}` : ''}` } : {}),
        ...(t.travelTime ? { duration: `~${String(t.travelTime).slice(0, 8)} h` } : {}),
        ...(Number.isFinite(seats) ? { seats_available: String(seats) } : {}),
        ...(busType ? { bus_type: busType.slice(0, 80) } : {}),
        ...(t.startTime ? { departure_time: String(t.startTime).slice(0, 5) } : {}),
        // Normalized timing keys (owner bug 21 Oct: bus timings not showing) — web and
        // Flutter both read arrival_time + duration_minutes; derive them from AbhiBus's
        // own arriveTime/travelTime fields, never invented.
        ...(t.arriveTime ? { arrival_time: String(t.arriveTime).slice(0, 5) } : {}),
        ...((() => {
          if (!t.travelTime) return {};
          const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t.travelTime).trim());
          const mins = m ? { duration_minutes: String(Number(m[1]) * 60 + Number(m[2])) } : {};
          return mins as Record<string, string>;
        })()),
        // structured facets from AbhiBus's own bus-type string (no invention)
        ac: /non[- ]?a\/?c/i.test(busType) ? 'no' : (/a\/?c|air conditioned/i.test(busType) ? 'yes' : ''),
        sleeper: /sleeper/i.test(busType) ? 'yes' : (/seater/i.test(busType) ? 'no' : ''),
        seater: /seater/i.test(busType) ? 'yes' : '',
        ...(rating ? { rating } : {}),
        ...(s?.busInsights?.busThumbnailUrl && /^https:\/\//.test(s.busInsights.busThumbnailUrl) ? { image_url: s.busInsights.busThumbnailUrl } : {}),
        platform: 'AbhiBus',
        data_note: 'Live fare and seats from AbhiBus public JSON API',
      },
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: key || String(s.serviceId || ''),
        rawFingerprint: fingerprint,
        extractedFields: ['title', 'price', 'departure', 'duration', ...(rating ? ['rating'] : []), 'availability'],
      },
    }));
  }
  return out.slice(0, 40);
}
