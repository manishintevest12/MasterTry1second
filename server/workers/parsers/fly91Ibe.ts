/**
 * Fly91 schedule parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * fly91.in runs the IBS iTravel IBE (Dojo/Spring WebFlow) behind AWS ALB —
 * NO WAF anywhere; the whole chain replays browserless with curl_cffi.
 * The Drupal homepage widget (custom.js #searchBtn handler) just redirects to:
 *   GET  /reservation/ibe/booking?mode=searchResultInter&wvm=WVMD&tripType=OW
 *        &origin=GOX&destination=HYD&travelDate=28-Oct-2026&adults=1
 *        &children=0&infants=0&cabinClass=ECONOMY&promoCode=&pointOfPurchase=OTHERS
 *        &channel=FLYWEB&locale=en_US&fareLevelSearch=ST&fareTypeSearch=SAVER
 * The response is a WebFlow shell whose <form action> carries the fresh
 * ;jsessionid + execution key. Re-POST the form with _eventId=showWtLblResult
 * and the same params to get the full SERVER-RENDERED results page:
 * per-flight divs (flight-number, dep/arr times, board/off points, duration,
 * div.flightAmount INR) plus a 7-day fare strip (span.fare INR).
 * Verified sandbox 24 Oct: GOX-HYD 28 Oct IC 5303 SDW 12:10 -> HYD 13:45,
 * 4,001 INR (SAVER), strip 25-31 Oct 5,777/9,000/5,777/4,001/3,201/3,600/4,650.
 * Note: nearby-airport flights (e.g. SDW instead of GOX) appear under
 * "More flight options from nearby airports" — parsed with their true
 * board point and clearly labelled.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const F91_IBE = 'https://fly91.in/reservation/ibe/';

/** ISO (YYYY-MM-DD) -> IBE travelDate (DD-MMM-YYYY, e.g. 28-Oct-2026). */
export function fly91Date(depIso: string): string {
  const m = depIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return depIso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]}-${months[Number(m[2]) - 1]}-${m[1]}`;
}

export function fly91BookingUrl(fromCode: string, toCode: string, depIso: string): string {
  return `${F91_IBE}booking?mode=searchResultInter&wvm=WVMD&tripType=OW&origin=${fromCode}&destination=${toCode}&travelDate=${fly91Date(depIso)}&adults=1&children=0&infants=0&cabinClass=ECONOMY&promoCode=&pointOfPurchase=OTHERS&channel=FLYWEB&locale=en_US&fareLevelSearch=ST&fareTypeSearch=SAVER`;
}

/** The WebFlow form body that triggers the results page. */
export function fly91EventBody(fromCode: string, toCode: string, depIso: string): string {
  return new URLSearchParams({
    _eventId: 'showWtLblResult', mode: 'searchResultInter', wvm: 'WVMD', tripType: 'OW',
    origin: fromCode, destination: toCode, travelDate: fly91Date(depIso),
    adults: '1', children: '0', infants: '0', cabinClass: 'ECONOMY', promoCode: '',
    pointOfPurchase: 'OTHERS', flightNumberOW: '', fareOW: '', flightNumberRT: '', fareRT: '',
    fareLevel: '', channel: 'FLYWEB', bookingSource: '', access_token: '', accessToken: '',
    skyscanner_redirectid: '', flexTrvlDates: '', ccType: '', deviceType: '',
    ibeScreenId: 'IBE000', fareTypeSearch: 'SAVER', fareLevelSearch: 'ST',
  }).toString();
}

/** Pull the WebFlow form action (with fresh jsessionid + execution key) out of the shell. */
export function fly91FormAction(shellHtml: string): string | null {
  const m = shellHtml.match(/action="([^"]*booking[^"]*)"/);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

export interface F91Flight {
  flightNo: string;
  depTime: string;
  arrTime: string;
  boardPoint: string;
  offPoint: string;
  durationMin: number;
  price: number;
  travelDate: string;
}

/** DD-MMM-YYYY -> ISO. */
function f91DateToIso(s: string): string | null {
  const m = (s || '').match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mo = months.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  return mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1]}` : null;
}

/**
 * Parse the server-rendered results page. Only flights whose flightDateValue
 * matches the requested date are emitted; nearby-airport flights keep their
 * real board point (flagged in the item, never silently relabelled).
 */
export function parseFly91Results(html: string, depIso: string): F91Flight[] {
  const want = fly91Date(depIso);
  const out: F91Flight[] = [];
  const blocks = html.split(/<div class="flight\s+"/).slice(1);
  for (const blk of blocks) {
    const dateVal = (blk.match(/id="flightDateValue" value="([^"]+)"/) || [])[1];
    if (!dateVal || dateVal !== want) continue;
    const flightNo = ((blk.match(/id="flightNumberValue" value="([^"]+)"/) || [])[1] || '').replace(/_.*$/, '').trim();
    const depTime = (blk.match(/id="flightDepartTime"[^>]*value="(\d{2}:\d{2})"/) || [])[1];
    const arrTime = (blk.match(/id="flightArrivTime" value="(\d{2}:\d{2})"/) || [])[1];
    const boardPoint = (blk.match(/id="boardPointValue" value="([A-Z]{3})"/) || [])[1];
    const offPoint = (blk.match(/id="offPointValue" value="([A-Z]{3})"/) || [])[1];
    const dur = (blk.match(/data-key="travelduration" data-value="(\d{2}):(\d{2})"/) || []);
    const durationMin = dur.length ? Number(dur[1]) * 60 + Number(dur[2]) : 0;
    const priceRaw = (blk.match(/class="flightAmount">\s*([\d,]+)\s*INR/) || [])[1];
    const price = priceRaw ? Number(priceRaw.replace(/,/g, '')) : 0;
    if (!flightNo || !depTime || !arrTime || !Number.isFinite(price) || price <= 0) continue;
    out.push({ flightNo, depTime, arrTime, boardPoint: boardPoint || '', offPoint: offPoint || '', durationMin, price, travelDate: depIso });
  }
  return out;
}

/** 7-day fare strip from the results page: [{dateIso, price}] (honest, may be partial). */
export function parseFly91FareStrip(html: string): { dt: string; pr: number }[] {
  const out: { dt: string; pr: number }[] = [];
  const re = /([A-Za-z]{3}), (\d{2})-([A-Za-z]{3})[\s\S]{0,160}?<span class="fare">\s*([\d,]+)\s*INR/g;
  const year = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const m of html.matchAll(re)) {
    const mo = months.findIndex((x) => x.toLowerCase() === m[3].toLowerCase());
    if (mo < 0) continue;
    const dt = `${year}-${String(mo + 1).padStart(2, '0')}-${m[2]}`;
    out.push({ dt, pr: Number(m[4].replace(/,/g, '')) });
  }
  return out;
}

/** Honest per-flight items (airline-direct seller, IBE deeplink). */
export function fly91FlightItems(
  flights: F91Flight[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return flights.map((f) => {
    const nearby = f.boardPoint && f.boardPoint !== fromCode;
    const routeCity = nearby ? `${f.boardPoint} (nearby ${fromCity})` : fromCity;
    return newRawItem(source, {
      title: `Fly91 ${routeCity} → ${toCity} on ${f.travelDate} from ₹${f.price} (${f.flightNo}, ${f.depTime}–${f.arrTime})`,
      brand: 'Fly91',
      price: f.price,
      currency: 'INR',
      seller: 'Fly91',
      sellerUrl: fly91BookingUrl(fromCode, toCode, depIso),
      travel: { route: `${routeCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: f.travelDate },
      attributes: {
        route: `${routeCity} → ${toCity}`,
        airline: 'Fly91',
        travel_date: f.travelDate,
        departure_date: f.travelDate,
        flight_number: f.flightNo,
        departure_time: f.depTime,
        arrival_time: f.arrTime,
        ...(f.durationMin ? { duration_minutes: String(f.durationMin) } : {}),
        ...(nearby ? { nearby_departure_airport: f.boardPoint } : {}),
        fare_class: 'SAVER (lowest published economy fare incl. taxes, convenience fee extra on Fly91 checkout)',
        price_basis: `Fly91 booking-engine price for ${f.travelDate} captured ${today}`,
        data_note: `Fare and schedule acquired from Fly91's own booking engine on ${today}; booking continues on Fly91's own website.`,
        image: '',
      },
      identifiers: { sku: `fly91-${f.flightNo}-${f.travelDate}-${f.boardPoint}${f.offPoint}`.replace(/\s+/g, '') },
      evidence: {
        sourceUrl: F91_IBE,
        extractedFields: ['flightNumberValue', 'flightDepartTime', 'boardPointValue', 'offPointValue', 'flightAmount (INR)'],
      },
    });
  });
}
