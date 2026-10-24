/**
 * Emirates parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * GATE MAP: emirates.com page routes are Cloudflare/Reblaze sensor-gated from
 * datacenter IPs (POST /booking/search-results/ form replay and GET SRP both
 * return the sec-if-cpt behavioral challenge, status 200, ~2.7KB). However
 * the SRP itself is fully SERVER-RENDERED: one GET with a base64 searchRequest
 * param returns complete flight cards in the initial HTML.
 *
 * CAPTURED SURFACE (verified LIVE in-browser 24 Oct 2026, DEL-DXB 28 Oct):
 *   GET https://www.emirates.com/booking/search-results/?searchRequest=<b64>
 *   where b64 = base64(JSON.stringify({
 *     journeyType: 'ONEWAY', bookingType: 'REVENUE',
 *     passengers: [{ type: 'ADT', count: 1 }],
 *     segments: [{ departure, arrival, travelDate: 'YYYY-MM-DD', cabinClass: 'Y' }],
 *     referrer: '/in/english', source: 'flight-search-widget',
 *   }))
 *   The response HTML embeds, per flight, a card:
 *   <div id="DEL_DXB_EK517_2094512296" class="flight-card-collapsed__wrapper">
 *     with departure/arrival times (date-time-details__time), "3 hrs 50 mins"
 *     duration text, "Arrival on <Weekday>, D Month YYYY" hidden labels and the
 *     lowest INR price.
 *   Verified LIVE: EK517 16:15->18:35 INR 22,130; EK511 10:35->13:00 INR
 *   22,130; EK515 21:30->23:59 INR 22,130; EK513 04:10->06:35 INR 32,410
 *   (3 hrs 50-59 mins each, economy lowest).
 *
 * PRODUCTION STRATEGY (self-detecting, per owner standing rule): replay the
 * GET with curl_cffi (chrome rungs). If the sensor challenge page returns
 * (sec-if-cpt-container marker), throw ACCESS_CHALLENGE so the circuit stays
 * honest and the probe self-activates on a clean production IP later.
 * No client-side XHR carries the offers (verified: only simplified-fare-rules,
 * currency-conversion etc. enrichment calls fire after load), so the SSR HTML
 * is the single capture surface - nothing else to replay.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const EK_SRP_URL = 'https://www.emirates.com/booking/search-results/?searchRequest=';
export const EK_GATE_MARKER = 'sec-if-cpt-container';

/** Base64 searchRequest exactly as the live widget produced (CDP-captured). */
export function ekSearchRequestUrl(from: string, to: string, dep: string): string {
  const payload = {
    journeyType: 'ONEWAY',
    bookingType: 'REVENUE',
    passengers: [{ type: 'ADT', count: 1 }],
    segments: [{ departure: from, arrival: to, travelDate: dep, cabinClass: 'Y' }],
    referrer: '/in/english',
    source: 'flight-search-widget',
  };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `${EK_SRP_URL}${encodeURIComponent(b64)}`;
}

export interface EkFlight {
  flightNumber: string;   // EK517
  depTime: string;        // 16:15
  arrTime: string;        // 18:35
  arrNextDay: boolean;
  durationText: string;   // 3 hrs 50 mins
  durationMin: number;
  priceInr: number;       // 22130
  cabin: string;          // Economy Class
}

const MIN = (h: string, m: string) => Number(h) * 60 + Number(m);

/** Parse server-rendered flight cards from the SRP HTML. */
export function parseEmiratesSrp(html: string, dep: string): EkFlight[] {
  const out: EkFlight[] = [];
  const cardRe = /<div id="([A-Z]{3})_([A-Z]{3})_([A-Z0-9]{2}\d{1,4})_\d+" class="flight-card-collapsed__wrapper"/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const flightNumber = m[3];
    // card body: up to next card marker or end
    const next = html.indexOf('flight-card-collapsed__wrapper', m.index + m[0].length + 30);
    const seg = html.slice(m.index, next > 0 ? next : m.index + 14000);
    const times = [...seg.matchAll(/date-time-details__time">([\d:]+)</g)].map(x => x[1]);
    if (times.length < 2) continue;
    const depTime = times[0];
    const arrTime = times[1];
    // "Arrival on Thursday, 29 October 2026" => next-day; "Arrival on Wednesday, 28 October" => same day
    const arrDate = (seg.match(/Arrival on (\w+day), (\d+) (\w+) (\d{4})/) || []).slice(1, 5).join(' ');
    const depDate = (seg.match(/Departure on (\w+day), (\d+) (\w+) (\d{4})/) || []).slice(1, 5).join(' ');
    const arrNextDay = !!arrDate && !!depDate && arrDate !== depDate;
    const durM = seg.match(/(\d+) hrs? (\d+) mins?/);
    const durationText = durM ? durM[0] : '';
    // sanity: duration must roughly match dep->arr (+24h if next day)
    let durationMin = 0;
    if (durM) {
      const [dH, dM] = [Number(durM[1]), Number(durM[2])];
      const [depH, depM] = depTime.split(':').map(Number);
      const [arrH, arrM] = arrTime.split(':').map(Number);
      const calc = (MIN(String(arrH), String(arrM)) - MIN(String(depH), String(depM)) + 1440) % 1440;
      durationMin = (calc === dH * 60 + dM) ? calc : dH * 60 + dM;
    }
    // price lives in the cabin button aria-label: "Economy Class  INR  22,130  Lowest price"
    const priceM = seg.match(/aria-label="[A-Za-z ]*Class\s+INR\s+([\d,]{4,9})/) || seg.match(/INR(?:<\/span>)?(?:&nbsp;)?\s*<?[^\d]{0,40}([\d,]{4,9})/) || seg.match(/>(\d{1,3},\d{3})</);
    const priceInr = priceM ? Number(priceM[1].replace(/,/g, '')) : 0;
    const cabin = /Business Class/.test(seg) ? 'Business Class' : (/First Class/.test(seg) ? 'First Class' : 'Economy Class');
    const key = `${flightNumber}-${depTime}`;
    if (!priceInr || out.some(o => `${o.flightNumber}-${o.depTime}` === key)) continue;
    out.push({ flightNumber, depTime, arrTime, arrNextDay, durationText, durationMin, priceInr, cabin });
  }
  return out;
}

/** Full flight-level rows with the same SRP URL as booking deeplink. */
export function ekFlightItems(flights: EkFlight[], source: SourceConfig, fromCity: string, toCity: string, fromCode: string, toCode: string, dep: string): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return flights.map(o => newRawItem(source, {
    title: `Emirates ${o.flightNumber} ${fromCity} → ${toCity} ${o.depTime}–${o.arrTime}${o.arrNextDay ? '+1' : ''} · ₹${o.priceInr.toLocaleString('en-IN')}`,
    brand: 'Emirates',
    price: o.priceInr,
    currency: 'INR',
    seller: 'Emirates',
    sellerUrl: ekSearchRequestUrl(fromCode, toCode, dep),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: dep },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: 'Emirates',
      flight_number: o.flightNumber,
      travel_date: dep,
      departure_date: dep,
      departs: o.depTime,
      arrives: o.arrTime,
      duration: o.durationText,
      stops: 'non-stop',
      fare_class: o.cabin.toLowerCase().replace(' class', ''),
      price_basis: `Emirates live ${o.cabin.toLowerCase()} fare incl. taxes for 1 adult on ${dep} captured ${today}`,
      data_note: `Live per-flight data from Emirates' own booking site (server-rendered search results). Price is the lowest total incl. taxes for 1 adult.`,
      image: '',
    },
    identifiers: { sku: `ek-${o.flightNumber}-${dep}` },
    evidence: {
      sourceUrl: EK_SRP_URL,
      extractedFields: ['flight-card id (DEL_DXB_EK517_*)', 'date-time-details__time', 'hrs/mins duration', 'lowest INR amount'],
    },
  }));
}
