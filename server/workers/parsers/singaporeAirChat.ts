/**
 * Singapore Airlines parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * GATE MAP: everything on *.singaporeair.com is Akamai-gated from datacenter
 * IPs (sandbox cold curl_cffi = 403 on every path). The classic booking flow
 * (flightsearch/externalFlightSearch.form) additionally requires reCAPTCHA.
 * The homepage React widget's SEARCH handler silently refuses under
 * automation (React Aria + bot-manager).
 *
 * THE OPEN SURFACE: the AI Mode "Flight Finder" (https://www.singaporeair.com/
 * ai-mode/chat) backend:
 *   POST https://www.singaporeair.com/ai-mode/api/chat
 *   Content-Type: application/json
 *   {"id": "<uuid>","message":{"id": "<uuid>","role":"user",
 *    "parts":[{"type":"text","text": "..."}]}}
 * responds with a text/event-stream. The backend agents call tools whose
 * inputs AND outputs are streamed inline:
 *   - validateAirports  -> route validity + airport metadata
 *   - getFareCache (farecache-cib) -> STRUCTURED fare JSON:
 *     data.results[].data[] = { origin, destination, cabin (Y), tripType (O),
 *       currency: INR, fares: [{ departureDate, fare: "27256",
 *       redirectionUrl: booking deeplink with checkSum }] }
 * Verified LIVE 24 Oct 2026 (in-page fetch replay, cold random uuid):
 *   DEL->SIN 28 Oct economy INR 27,256; BOM->SIN 30 Oct INR 43,427
 *   (both with ready booking links).
 *
 * HONESTY: fares come from SIA's fare cache, "based on recent searches up
 * to 4 days old" (the chat says so) - disclosed in data_note. No flight
 * numbers/times are available from this surface (date-level fare rows,
 * same as the Via.com fare-calendar pattern).
 *
 * PRODUCTION: Akamai 403 expected from datacenter IPs; the worker uses the
 * MMT-style self-detecting full-flow probe: bootstrap (GET /ai-mode/chat)
 * then POST /ai-mode/api/chat; 403/challenge -> blocked presence with
 * escalating backoff and full reset on success.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const SIA_HOME = 'https://www.singaporeair.com/';
export const SIA_CHAT_PAGE = 'https://www.singaporeair.com/ai-mode/chat';
export const SIA_CHAT_API = 'https://www.singaporeair.com/ai-mode/api/chat';

/** Chat prompt that deterministically triggers the fare-cache agent. */
export function siaChatPrompt(fromCode: string, toCode: string, depIso: string, dateHuman: string): string {
  return `Cheapest one-way economy fare from ${fromCode} to ${toCode} on ${dateHuman} (${depIso}) for 1 adult.`;
}

/** Request body for POST /ai-mode/api/chat (fresh uuid session each call). */
export function siaChatBody(prompt: string, uuid: () => string): string {
  return JSON.stringify({
    id: uuid(),
    message: { id: uuid(), role: 'user', parts: [{ type: 'text', text: prompt }] },
  });
}

export interface SiaFareRow {
  origin: string;
  destination: string;
  cabin: string;          // 'Y'
  tripType: string;       // 'O'
  currency: string;       // 'INR'
  departureDate: string;  // '2026-10-28'
  fare: number;           // 27256
  redirectionUrl: string; // booking deeplink
}

/**
 * Parse the SSE stream and extract the getFareCache tool output rows.
 * Shape-tolerant: scans data: lines for tool-output-available events whose
 * output.data.results[].data[].fares[] carries date-level fares.
 */
export function parseSiaChatStream(stream: string): SiaFareRow[] {
  const rows: SiaFareRow[] = [];
  const seen = new Set<string>();
  const re = /data:\s*(\{[\s\S]*?\})\s*(?=\ndata:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream || ''))) {
    let e: any;
    try { e = JSON.parse(m[1]); } catch { continue; }
    if (e?.type !== 'tool-output-available' || !e.output?.data?.results) continue;
    for (const res of e.output.data.results as any[]) {
      for (const d of res?.data || []) {
        for (const f of d?.fares || []) {
          const fare = Number(String(f.fare || '').replace(/[^\d.]/g, ''));
          const dep = String(f.departureDate || '');
          if (!fare || !/^\d{4}-\d{2}-\d{2}$/.test(dep)) continue;
          const key = `${d.origin}-${d.destination}-${dep}-${d.cabin}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            origin: String(d.origin || ''),
            destination: String(d.destination || ''),
            cabin: String(d.cabin || 'Y'),
            tripType: String(d.tripType || 'O'),
            currency: String(d.currency || 'INR'),
            departureDate: dep,
            fare,
            redirectionUrl: String(f.redirectionUrl || ''),
          });
        }
      }
    }
  }
  return rows;
}

/** True when the SSE stream shows the airports-validation rejected the route. */
export function siaRouteInvalid(stream: string): boolean {
  const re = /data:\s*(\{[\s\S]*?\})\s*(?=\ndata:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stream || ''))) {
    let e: any;
    try { e = JSON.parse(m[1]); } catch { continue; }
    if (e?.type !== 'tool-output-available' || !e.output?.data?.airportDetails) continue;
      const det = e.output.data.airportDetails[0];
      if (det && (det.originInfo?.isValidAirportCode === false || det.destinationInfo?.isValidAirportCode === false)) return true;
  }
  return false;
}

/** Akamai block signatures on the chat API (403/challenge). */
export function siaIsGated(status: number, body: string): boolean {
  if (status === 403 || status === 429) return true;
  const b = body || '';
  return /Access Denied|Challenge Validation|edgesuite\.net/i.test(b) && b.length < 20_000;
}

/** Honest date-level fare rows (airline-direct seller + booking deeplink). */
export function siaFareItems(
  rows: SiaFareRow[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((r) => r.departureDate === depIso)
    .map((r) => newRawItem(source, {
      title: `Singapore Airlines ${fromCity} → ${toCity} on ${r.departureDate} from ₹${r.fare.toLocaleString('en-IN')} (economy)`,
      brand: 'Singapore Airlines',
      price: r.fare,
      currency: r.currency,
      seller: 'Singapore Airlines',
      sellerUrl: r.redirectionUrl || SIA_HOME,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: r.departureDate },
      attributes: {
        route: `${fromCity} → ${toCity}`,
        airline: 'Singapore Airlines',
        travel_date: r.departureDate,
        departure_date: r.departureDate,
        fare_class: 'Economy (cabin Y)',
        stops: '',
        price_basis: `Singapore Airlines fare-cache lowest one-way economy fare for 1 adult on ${r.departureDate} captured ${today}`,
        data_note: `Fare from Singapore Airlines' own fare cache (via their AI Flight Finder), based on recent searches up to 4 days old - current fare may differ at booking. Booking link goes to Singapore Airlines' own website.`,
        image: '',
      },
      identifiers: { sku: `sia-${r.origin}${r.destination}-${r.departureDate}-${r.cabin}` },
      evidence: {
        sourceUrl: SIA_CHAT_API,
        extractedFields: ['getFareCache data.results[].data[].fares[] (departureDate, fare, redirectionUrl)'],
      },
    }));
}
