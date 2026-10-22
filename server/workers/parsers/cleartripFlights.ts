/**
 * Cleartrip flights parser (17 Oct 2026) — LIVE via desktop search API.
 *
 * GET www.cleartrip.com/flight/search/v2?from=DEL&to=BOM&depart_date=25/10/2026&adults=1
 * with headers x-client-id cleartrip, channel desktop, app-agent DESKTOP, caller UI,
 * x-unified-header {"platform":"desktop","trackingId":<uuid>,"source":"CLEARTRIP"}
 * (all lifted from cleartrip's own Next.js bundle main-9cf33a8300b7800f.js).
 *
 * Response: cards.J1[] = one card per itinerary:
 *   - travelOptionId "QP-1805-DEL-BOM-1792892400"
 *   - summary.flights[] {airlineCode, flightNumber} (one per leg)
 *   - summary.firstDeparture/lastArrival {airport.code, time ISO +05:30}
 *   - summary.totalDuration {hh,mm}, stops, timelineText ("Non-stop")
 * card.subTravelOptionIds[0] -> subTravelOptions[id].fareIds[0]
 *   -> fares[id].pricing.totalPricing.totalPrice (INR number),
 *      totalBaseFare, totalTax, message = live coupon text
 *      ("₹934 off with BBDHDFC", couponDetails.discountAmount).
 * Verified live 17 Oct: DEL-BOM 194 cards (QP-1805 Rs6675, 6E-6814 Rs6845),
 * BLR-DEL 206, BOM-BLR 176. The old "client-side only" verdict is superseded —
 * the v2 search API is server-rendered JSON with no session/Akamai gate.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { EMT_AIRLINES } from './emtFareCalendar';

export interface CtParsedFlight {
  offer: RawSourceItem;
  price: number;
}

export function cleartripSearchUrl(from: string, to: string, depDmy: string): string {
  return `https://www.cleartrip.com/flight/search/v2?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&depart_date=${encodeURIComponent(depDmy)}&adults=1`;
}

interface CtCard {
  travelOptionId?: string;
  summary?: {
    flights?: { airlineCode?: string; flightNumber?: string }[];
    firstDeparture?: { airport?: { code?: string }; time?: string };
    lastArrival?: { airport?: { code?: string }; time?: string };
    totalDuration?: { hh?: number; mm?: number };
    stops?: number;
    timelineText?: string;
  };
  subTravelOptionIds?: string[];
}

/**
 * Parse a Cleartrip /flight/search/v2 response into offers.
 * fromCity/toCity are display names; depIso is the search date (YYYY-MM-DD).
 */
export function parseCleartripFlights(
  body: string,
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  depIso: string,
): RawSourceItem[] {
  let d: any = null;
  try { d = JSON.parse(body); } catch { return []; }
  const cards: CtCard[] = d?.cards?.J1;
  const subOptions = d?.subTravelOptions || {};
  const fares = d?.fares || {};
  if (!Array.isArray(cards) || !cards.length) return [];

  const out: RawSourceItem[] = [];
  for (const c of cards) {
    const s = c.summary || {};
    const legs = Array.isArray(s.flights) ? s.flights : [];
    if (!legs.length) continue;
    const airlineCode = String(legs[0].airlineCode || '');
    const flightNo = legs.map((l: any) => `${l.airlineCode || ''}${l.flightNumber || ''}`.trim())
      .join('/').slice(0, 40);
    const st = Array.isArray(c.subTravelOptionIds) ? subOptions[c.subTravelOptionIds[0]] : null;
    const fareId = st?.fareIds?.[0] || st?.cheapestFareId;
    const fare = fareId ? fares[fareId] : null;
    const price = Number(fare?.pricing?.totalPricing?.totalPrice);
    if (!Number.isFinite(price) || price <= 0) continue;

    const airlineName = EMT_AIRLINES[airlineCode]?.name || airlineCode || 'Flight';
    const stops = Number(s.stops || 0);
    // Self-heal 22 Oct: Cleartrip moved times to firstDeparture.airport.time
    // (verified live: 2026-10-29T07:15:00.000+05:30); the old flat .time path
    // returned undefined and every Cleartrip row rendered time-less.
    const depT = String(s.firstDeparture?.time || (s.firstDeparture as any)?.airport?.time || '').slice(11, 16);
    const arrT = String(s.lastArrival?.time || (s.lastArrival as any)?.airport?.time || '').slice(11, 16);
    const dur = s.totalDuration ? `${String(s.totalDuration.hh || 0).padStart(2, '0')}h ${String(s.totalDuration.mm || 0).padStart(2, '0')}m` : '';
    const couponMsg = String(fare?.pricing?.totalPricing?.message || '').trim();
    const srpUrl = `https://www.cleartrip.com/flights/results?from=${s.firstDeparture?.airport?.code || ''}&to=${s.lastArrival?.airport?.code || ''}&depart_date=${depIso}&adults=1`;

    out.push(newRawItem(source, {
      title: `${airlineName} ${flightNo} ${fromCity} → ${toCity} ${stops ? `(${stops} stop${stops > 1 ? 's' : ''})` : 'non-stop'}`.slice(0, 200),
      brand: airlineName,
      price: Math.round(price),
      currency: 'INR',
      seller: 'Cleartrip',
      sellerUrl: srpUrl,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: depIso },
      attributes: {
        airline: airlineName,
        flight_number: flightNo,
        travel_date: depIso,
        ...(depT ? { departure: depT } : {}),
        ...(arrT ? { arrival: arrT } : {}),
        stops: String(stops),
        origin: String(s.firstDeparture?.airport?.code || ''),
        destination: String(s.lastArrival?.airport?.code || ''),
        ...(dur ? { duration: dur } : {}),
        ...(couponMsg ? { coupon: couponMsg } : {}),
        price_basis: `total Cleartrip fare for 1 adult (base ₹${fare?.pricing?.totalPricing?.totalBaseFare ?? '?'} + tax ₹${fare?.pricing?.totalPricing?.totalTax ?? '?'}) from Cleartrip's own search API on ${new Date().toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Cleartrip's flight search API on ${new Date().toISOString().slice(0, 10)}${couponMsg ? `; active Cleartrip coupon: ${couponMsg}` : ''}; booking continues on Cleartrip's own website.`,
        image: '',
      },
      identifiers: { sku: String(c.travelOptionId || flightNo).slice(0, 120) },
      evidence: {
        sourceUrl: cleartripSearchUrl(s.firstDeparture?.airport?.code || '', s.lastArrival?.airport?.code || '', depIso.split('-').reverse().join('/')),
        extractedFields: ['cards.J1[].summary', 'subTravelOptions[].fareIds[0]', 'fares[].pricing.totalPricing.totalPrice (INR)'],
      },
    }));
  }
  return out;
}
