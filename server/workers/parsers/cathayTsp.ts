/**
 * Cathay Pacific parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * GATE MAP: www.cathaypacific.com is fully reachable from datacenter IPs, but
 * the NEW booking engine ("TSP") lives at book.cathaypacific.com (Akamai) and
 * its data APIs at api.cathaypacific.com/tsp-svc/v1.0/ (Akamai rules differ
 * per endpoint - sandbox observed: offer-flights passes Akamai but needs a
 * primed session; create-session and air-calendar hard-403).
 *
 * CAPTURED SURFACE (verified LIVE in-browser 24 Oct 2026, BOM-HKG 29 Oct):
 *   1. GET /tsp-svc/v1.0/create-session?origin=BOM&destination=HKG&departureDate=2026-10-29
 *        &cabinClass=Y&entryLanguage=en&entryCountry=IN&adult=1&youngAdult=0&child=0&infant=0&student=0
 *      -> {"data":{"status":"SUCCESS"}} (primes the server-side session)
 *   2. GET /tsp-svc/v1.0/offer-flights?type=OW&<same params>
 *      -> {"data":{"flightList":[{"flightDetails":{"flightCard":{origin,destination,
 *         flightNumberList,duration,totalPrice[{value,currencyCode,cabinClass,isLowestPrice}]},
 *         "flightSegments":[{flightInfo:{marketingAirlineCode,operatingAirlineCode,
 *         marketingFlightNumber,aircraftCode,duration,departure{airportCode,dateTime,terminal},
 *         arrival{...}, ...}}]},"flightOffers":[{cabinClass,fareFamilyName,isCheapestOffer,
 *         unitPrice{value,currencyCode},availabilityDetails[{quota}],benefits{baggage...}}]}]}}
 *      LIVE: 46 itineraries BOM-HKG 29 Oct, e.g. CX660 02:00 IST -> 09:55 HKT
 *      77W 5h25m economy from INR 33,746 (checked 23kg + cabin 7kg included).
 *   3. GET /tsp-svc/v1.0/air-calendar?<same params> -> per-date lowest fares
 *      strip (calendars[].departureDate + prices.amount, INR).
 *   Booking deeplink (reproducible, no session needed):
 *   https://book.cathaypacific.com/tsp/en_IN/flight-selection?ca=Y&o=BOM&d=HKG&a=1&ya=0&ch=0&i=0&ddb1=YYYY-MM-DD&viewport=desktop
 *
 * PRODUCTION STRATEGY (self-detecting, owner standing rule): 3-rung curl_cffi
 * ladder; create-session 403 (Akamai) or offer-flights "No session found" =>
 * honest ACCESS_CHALLENGE; probe self-activates on a clean production IP
 * (Air India / SIA pattern).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const CX_TSP_API = 'https://api.cathaypacific.com/tsp-svc/v1.0/';
export const CX_DEEPLINK = 'https://book.cathaypacific.com/tsp/en_IN/flight-selection';

export function cxParams(from: string, to: string, dep: string): string {
  return `origin=${from}&destination=${to}&departureDate=${dep}&cabinClass=Y&entryLanguage=en&entryCountry=IN&adult=1&youngAdult=0&child=0&infant=0&student=0`;
}

export function cxDeeplink(from: string, to: string, dep: string): string {
  return `${CX_DEEPLINK}?ca=Y&o=${from}&d=${to}&a=1&ya=0&ch=0&i=0&ddb1=${dep}&viewport=desktop`;
}

export interface CxFlight {
  flightNumber: string;      // CX660 (first marketing flight; CX-prefixed if present)
  allFlights: string[];      // ["AI2869","CX672"] for connections
  depTime: string;           // 02:00 (local, ISO from API)
  arrTime: string;           // 09:55
  depIso: string;            // 2026-10-29T02:00:00.000+05:30
  arrIso: string;
  durationMin: number;       // 325
  stops: number;             // transit count (0 = non-stop)
  transitVia: string[];      // ["KTM"]
  priceInr: number;          // cheapest economy total incl. taxes
  cabinClass: string;       // Y
  aircraft: string;         // 77W
  seatsLeft: number | null;  // quota if exposed
  baggageNote: string;       // 'checked 23kg + cabin 7kg'
}

const isoTime = (iso: string) => (iso || '').slice(11, 16);

/** Parse the offer-flights JSON into flight rows. */
export function parseCathayOfferFlights(body: string): CxFlight[] {
  let d: any;
  try { d = JSON.parse(body); } catch { return []; }
  const list = d?.data?.flightList;
  if (!Array.isArray(list)) return [];
  const out: CxFlight[] = [];
  for (const f of list) {
    const card = f?.flightDetails?.flightCard;
    const segs = f?.flightDetails?.flightSegments || [];
    if (!card || !segs.length) continue;
    const segInfos = segs.map((s: any) => s?.flightInfo).filter(Boolean);
    if (!segInfos.length) continue;
    const first = segInfos[0];
    const last = segInfos[segInfos.length - 1];
    const allFlights = segInfos.map((s: any) => `${s.marketingAirlineCode}${s.marketingFlightNumber}`);
    // prefer a CX marketing flight as the headline number
    const headline = allFlights.find((x: string) => /^CX/.test(x)) || allFlights[0];
    // transit airports = arrival of every segment except the last
    const transitVia = segInfos.slice(0, -1).map((s: any) => s.arrival?.airportCode).filter(Boolean);
    // stops: (segments - 1); direct flights on this route have exactly 1 segment
    const stops = Math.max(0, segInfos.length - 1);
    const ecoPrice = (card.totalPrice || []).find((p: any) => p.cabinClass === 'Y' && p.isLowestPrice)
      || (card.totalPrice || []).find((p: any) => p.cabinClass === 'Y')
      || (card.totalPrice || [])[0];
    const priceInr = ecoPrice?.currencyCode === 'INR' ? ecoPrice.value : (ecoPrice ? ecoPrice.value : 0);
    const cheapOffer = (f.flightOffers || []).find((o: any) => o.isCheapestOffer) || (f.flightOffers || [])[0];
    const quota = cheapOffer?.availabilityDetails?.[0]?.quota;
    const baggage = cheapOffer?.benefits?.baggage || [];
    const checked = baggage.find((b: any) => b.key === 'checkedBaggage');
    const cabinBag = baggage.find((b: any) => b.key === 'cabinBaggage');
    const baggageNote = [checked && `checked ${(checked.policyDetails || []).find((p: any) => p.unit === 'kilogram')?.value}kg`,
      cabinBag && `cabin ${(cabinBag.policyDetails || []).find((p: any) => p.unit === 'kilogram')?.value}kg`].filter(Boolean).join(' + ');
    const key = `${headline}-${isoTime(first.departure?.dateTime || '')}`;
    if (!priceInr || out.some(o => `${o.flightNumber}-${o.depTime}` === key)) continue;
    out.push({
      flightNumber: headline,
      allFlights,
      depTime: isoTime(first.departure?.dateTime || ''),
      arrTime: isoTime(last.arrival?.dateTime || ''),
      depIso: first.departure?.dateTime || '',
      arrIso: last.arrival?.dateTime || '',
      durationMin: Math.round((card.duration || first.duration || 0) / 60),
      stops,
      transitVia,
      priceInr,
      cabinClass: ecoPrice?.cabinClass || 'Y',
      aircraft: first.aircraftCode || '',
      seatsLeft: typeof quota === 'number' ? quota : null,
      baggageNote,
    });
  }
  return out;
}

export interface CxFareDay { date: string; priceInr: number }

/** Parse the air-calendar JSON (fare strip) into date->lowest INR. */
export function parseCathayAirCalendar(body: string): CxFareDay[] {
  let d: any;
  try { d = JSON.parse(body); } catch { return []; }
  const cals = d?.data?.calendars;
  if (!Array.isArray(cals)) return [];
  const out: CxFareDay[] = [];
  for (const c of cals) {
    const amount = c?.prices?.amount;
    if (c.departureDate && typeof amount === 'number') out.push({ date: c.departureDate, priceInr: amount });
  }
  return out;
}

/** Full flight-level rows with the TSP deeplink as booking URL. */
export function cxFlightItems(flights: CxFlight[], source: SourceConfig, fromCity: string, toCity: string, fromCode: string, toCode: string, dep: string, fareStrip?: CxFareDay[]): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const stripNote = fareStrip && fareStrip.length
    ? `Week around ${dep}: ${fareStrip.map(s => `${s.date.slice(5)} ₹${s.priceInr.toLocaleString('en-IN')}`).join(', ')}`
    : '';
  return flights.map(o => newRawItem(source, {
    title: `Cathay Pacific ${o.flightNumber} ${fromCity} → ${toCity} ${o.depTime}–${o.arrTime} · ₹${o.priceInr.toLocaleString('en-IN')}`,
    brand: 'Cathay Pacific',
    price: o.priceInr,
    currency: 'INR',
    seller: 'Cathay Pacific',
    sellerUrl: cxDeeplink(fromCode, toCode, dep),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: dep },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: /AI/.test(o.allFlights.join('')) ? 'Cathay Pacific (codeshare w/ Air India)' : 'Cathay Pacific',
      flight_number: o.flightNumber,
      travel_date: dep,
      departure_date: dep,
      departs: o.depTime,
      arrives: o.arrTime,
      duration: o.durationMin ? `${Math.floor(o.durationMin / 60)}h ${o.durationMin % 60}m` : '',
      stops: o.stops === 0 ? 'non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}${o.transitVia.length ? ` via ${o.transitVia.join(', ')}` : ''}`,
      fare_class: o.cabinClass === 'Y' ? 'economy' : o.cabinClass,
      baggage: o.baggageNote || '',
      seats_left: String(o.seatsLeft ?? ''),
      aircraft: o.aircraft,
      price_basis: `Cathay Pacific live ${o.cabinClass === 'Y' ? 'economy' : o.cabinClass} fare incl. taxes for 1 adult on ${dep} captured ${today}`,
      data_note: 'Live per-flight data from Cathay Pacific\'s own booking engine (tsp-svc offer-flights API). Price is the lowest total incl. taxes for 1 adult.',
      fare_strip: stripNote,
      image: '',
    },
    identifiers: { sku: `cx-${o.flightNumber}-${dep}` },
    evidence: {
      sourceUrl: CX_TSP_API,
      extractedFields: ['flightCard.flightNumberList', 'flightSegments[].flightInfo (ISO dep/arr, aircraft)', 'flightOffers[].unitPrice', 'air-calendar prices'],
    },
  }));
}
