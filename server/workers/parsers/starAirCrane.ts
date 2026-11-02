/**
 * Star Air schedule parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * starair.in's booking engine is Crane Aero IBE (hitit-ui) hosted at
 * book-sdg.crane.aero. The full flow captured via CDP:
 *   homepage form POST -> server-side redirect to
 *   GET book-sdg.crane.aero/ibe/availability?lang=en&tripType=ONE_WAY&depPort=
 *   &arrPort=&departureDate=DD.MM.YYYY&cabinClasses=ECONOMY&passengerQuantities...
 *
 * The availability page is fully SERVER-RENDERED and works with a COLD
 * curl_cffi session (no cookies/tokens/JS) - completely open, no gating.
 * Verified live 24 Oct: S5-164 BOM 10:35 -> KLH 11:40 (1h 05m, non-stop)
 * from INR 4,563 (STAR REGULAR best offer; BUSINESS 7,000); BOM-AMD has
 * S5-705 + S5-629 from INR 7,199; routes without service return an honest
 * small no-flights page.
 *
 * Page structure (shape-tolerant parsing):
 *  - journeys: <div class="js-journey" data-stop-count data-journey-duration
 *    data-arr-date data-dep-date (epoch ms)> with .time (dep/arr hh:mm),
 *    .port ("Mumbai (BOM)"), .flight-no (S5-164), .flight-duration,
 *    .total-stop
 *  - fares: <div class="price-block cabin-name-STAR REGULAR"><span
 *    class="price-best-offer ">4,563</span> (one price-block per cabin)
 *  - 7-day fare strip: .price-text-with-blocks prices after each date label
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const STAR_HOME = 'https://www.starair.in/';
export const STAR_DESTINATIONS = 'https://www.starair.in/home/LoadDestination?regionCode=';
export const STAR_AVAIL = 'https://book-sdg.crane.aero/ibe/availability';

/** ISO (YYYY-MM-DD) -> DD.MM.YYYY for the availability GET. */
export function starDateParam(depIso: string): string {
  const m = depIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : depIso;
}

/** The exact availability GET URL (cold-session friendly). */
export function starAvailUrl(fromCode: string, toCode: string, depIso: string): string {
  const p = new URLSearchParams();
  p.set('lang', 'en');
  p.set('tripType', 'ONE_WAY');
  p.set('depPort', fromCode);
  p.set('arrPort', toCode);
  p.set('departureDate', starDateParam(depIso));
  p.set('cabinClasses', 'ECONOMY');
  p.set('passengerQuantities[0][passengerType]', 'ADLT');
  p.set('passengerQuantities[0][quantity]', '1');
  p.set('passengerQuantities[1][passengerType]', 'CHLD');
  p.set('passengerQuantities[1][quantity]', '0');
  p.set('passengerQuantities[2][passengerType]', 'INFT');
  p.set('passengerQuantities[2][quantity]', '0');
  return `${STAR_AVAIL}?${p.toString()}`;
}

/** JSON array of valid destination codes for an origin (starair.in API). */
export async function starValidDestinations(fromCode: string, cffiGet: (u: string) => Promise<string>): Promise<string[]> {
  try {
    const raw = await cffiGet(`${STAR_DESTINATIONS}${fromCode}`);
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]) as { Value?: string }[];
    return arr.map((x) => String(x.Value || '')).filter((v) => /^[A-Z]{3}$/.test(v));
  } catch { return []; }
}

export interface StarJourney {
  flightNo: string;       // 'S5-164'
  depTime: string;         // '10:35'
  arrTime: string;         // '11:40'
  depDateIso: string;      // '2026-10-28'
  fromCode: string;
  toCode: string;
  stops: number;
  durationMin: number;     // 65
  fareEconomy: number;     // 4563 (best offer)
  fareBusiness: number;    // 7000 (0 if absent)
}

/** '28 Oct 2026' -> '2026-10-28'; epoch ms -> 'YYYY-MM-DD' (IST). */
function starIsoDate(dateText: string, epochMs?: number): string {
  if (epochMs) {
    const d = new Date(epochMs + 5.5 * 3600_000);
    return d.toISOString().slice(0, 10);
  }
  const m = String(dateText || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mo = months.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mo < 0) return '';
  return `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

/**
 * Parse the server-rendered availability HTML.
 * Shape-tolerant: works on the cold-session HTML (no JS execution needed).
 */
export function parseStarAirAvailability(html: string, depIso: string): StarJourney[] {
  const b = html || '';
  const out: StarJourney[] = [];
  // split into journey chunks
  const parts = b.split(/<div class="js-journey"/);
  for (const part of parts.slice(1)) {
    const chunk = part;
    const attr = (name: string) => {
      const m = chunk.match(new RegExp(`data-${name}="(\\d+)"`));
      return m ? m[1] : '';
    };
    const stops = Number(attr('stop-count') ?? 0);
    const durationSec = Number(attr('journey-duration') ?? 0);
    const depEpoch = Number(attr('dep-date') ?? 0);
    const arrEpoch = Number(attr('arr-date') ?? 0);
    const flightNo = ((chunk.match(/class="flight-no">([^<]+)</) || [])[1] || '').replace(/\s+/g, '');
    if (!flightNo) continue;
    const times = [...chunk.matchAll(/<span class="time">\s*(\d{1,2}:\d{2})\s*</g)].map((m) => m[1]);
    const ports = [...chunk.matchAll(/class="port">\s*[^<]*?\(([A-Z]{3})\)\s*</g)].map((m) => m[1]);
    const dateTexts = [...chunk.matchAll(/class="date">\s*([^<]+?)\s*</g)].map((m) => m[1]);
    const depTime = times[0] || '';
    const arrTime = times[times.length - 1] || '';
    const fromCode = ports[0] || '';
    const toCode = ports[ports.length - 1] || '';
    const depDateIso = starIsoDate(dateTexts[0] || '', depEpoch || undefined);
    if (!depTime || !arrTime || !fromCode || !toCode) continue;
    if (depDateIso !== depIso) continue; // honest exact-date rows only
    // fares: one price-block per cabin within this chunk
    let fareEconomy = 0, fareBusiness = 0;
    for (const fm of chunk.matchAll(/price-block\s+cabin-name-([^"]*)"[^>]*>\s*(?:<span[^>]*>\s*INR\s*<\/span>)?\s*<span[^>]*(?:price-best-offer|price)[^>]*>\s*([\d,]+)/g)) {
      const cabin = fm[1].toUpperCase();
      const amount = Number(fm[2].replace(/,/g, ''));
      if (!amount) continue;
      if (cabin.includes('BUSINESS')) { if (!fareBusiness || amount < fareBusiness) fareBusiness = amount; }
      else { if (!fareEconomy || amount < fareEconomy) fareEconomy = amount; }
    }
    const durationMin = durationSec ? Math.round(durationSec / 60) : 0;
    out.push({ flightNo, depTime, arrTime, depDateIso, fromCode, toCode, stops, durationMin, fareEconomy, fareBusiness });
  }
  return out;
}

/**
 * 7-day lowest-fare strip from the availability page calendar
 * (date-level fares; used for the honest data_note, not as separate rows).
 */
export function starFareStrip(html: string): { dateIso: string; price: number }[] {
  const b = html || '';
  const strip: { dateIso: string; price: number }[] = [];
  const zone = b;
  const re = /<strong>(\d{1,2})<\/strong>[\s\S]{0,250}?>(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[\s\S]{0,800}?price-text-with-blocks">\s*<span>INR<\/span>\s*<span>([\d,]+)<\/span>/g;
  let m: RegExpExecArray | null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // OWNER 2 Nov (date-wise fares): the strip prints DAY NUMBERS only, so stamping every one of them
  // with the current month mislabels the whole strip as soon as it crosses a month boundary (a
  // 7-day strip opened on 28 Oct listed 2 Nov as 2026-10-02). Each day now resolves to its nearest
  // occurrence that is today or later.
  const nearestUpcoming = (day: number): string => {
    for (let add = 0; add <= 2; add += 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + add, day));
      if (d.getUTCDate() !== day) continue;
      if (d.getTime() >= todayUtc) return d.toISOString().slice(0, 10);
    }
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day)).toISOString().slice(0, 10);
  };
  while ((m = re.exec(zone))) {
    const day = Number(m[1]);
    const price = Number(m[2].replace(/,/g, ''));
    if (!day || !price) continue;
    const iso = nearestUpcoming(day);
    if (!strip.some((s) => s.dateIso === iso)) strip.push({ dateIso: iso, price });
  }
  return strip;
}

/** Honest per-flight rows (airline-direct seller). */
export function starAirFlightItems(
  journeys: StarJourney[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return journeys.map((j) => {
    const price = j.fareEconomy || j.fareBusiness;
    return newRawItem(source, {
      title: `Star Air ${j.flightNo} ${fromCity} → ${toCity} on ${j.depDateIso} from ₹${price} (${j.depTime}–${j.arrTime})`,
      brand: 'Star Air',
      price,
      currency: 'INR',
      seller: 'Star Air',
      sellerUrl: STAR_HOME,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: j.depDateIso },
      attributes: {
        route: `${fromCity} → ${toCity}`,
        airline: 'Star Air',
        flight_number: j.flightNo,
        travel_date: j.depDateIso,
        departure_date: j.depDateIso,
        departure: j.depTime,
        arrival: j.arrTime,
        stops: String(j.stops),
        ...(j.durationMin ? { duration: j.durationMin >= 60 ? `${Math.floor(j.durationMin / 60)}h ${j.durationMin % 60}m` : `${j.durationMin}m` } : {}),
        ...(j.fareEconomy ? { fare_class: `STAR REGULAR (economy best offer incl. taxes)${j.fareBusiness ? `; business from ₹${j.fareBusiness}` : ''}` } : {}),
        price_basis: `Star Air booking-engine fare for 1 adult on ${j.depDateIso} (economy ₹${j.fareEconomy}${j.fareBusiness ? `, business ₹${j.fareBusiness}` : ''}) captured ${today}`,
        data_note: `Fare and schedule from Star Air's own booking engine (Crane Aero) on ${today}; booking continues on Star Air's own website. Fare may change at checkout.`,
        image: '',
      },
      identifiers: { sku: `s5-${j.flightNo}-${j.depDateIso}-${j.fromCode}${j.toCode}` },
      evidence: {
        sourceUrl: STAR_AVAIL,
        extractedFields: ['js-journey data-attrs (dep/arr epoch, stops, duration)', 'flight-no', 'price-block cabin fares (INR)'],
      },
    });
  });
}
