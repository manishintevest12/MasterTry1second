/**
 * SriLankan Airlines schedule parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * srilankan.com runs the Amadeus "pl-next" IBE at book.srilankan.com/plnext/
 * srilanankanairDX (git 26.1.40, aria-templates). The booking chain captured
 * via CDP (allowed for discovery; production replays browserless):
 *
 *  1. GET  www.srilankan.com/en_uk/ca  (ASP.NET homepage; hidden #idxxui token)
 *  2. POST www.srilankan.com/en_uk/home/srilakan-override  (widget params:
 *     seldcity1/selacity1/suggest1/suggest2/selddate1/tid=OW/selcabinclass=E/
 *     fromdate=YYYYMMDD0000/sitelang=GB/resultby=1 + idxxui) -> override page
 *  3. POST book.srilankan.com/plnext/srilankanairDX/Override.action?
 *     SITE=CBGVCNEW&LANGUAGE=GB&EMBEDDED_TRANSACTION=FlexPricerAvailability&
 *     ENCT=1&ENC=<server-generated hex from the override page>
 *     -> FDCS fare-calendar page (7-day date-level lowest fares server-rendered)
 *  4. The availability page (FlexPricerAvailabilityDispatcherPui.action)
 *     embeds a FULL Amadeus flex-pricer JSON in the HTML:
 *     business.Availability = { proposedBounds[].proposedFlightsGroup[].segments[]:
 *     uniqueId 'UL0122281026', flightNumber '122', airline UL, beginDate/
 *     endDate ('Oct 28, 2026, 9:50:00 AM'), city codes, nbrOfStops, equipment },
 *     recommendationList[]: bounds[].boundAmount { totalAmount INR, tax,
 *     amountWithoutTax, alreadyIncludedDiscount }, fare family ffCode,
 *     numberOfSeatsLeft, travellerPrices.ADT }.
 *
 * Verified live 24 Oct (CDP capture, Browserbase): UL0122 (UL 122) MAA 09:50
 * -> CMB 11:10, A320 (32B), non-stop; cheapest recommendation 9,495 INR
 * (base 3,705 + tax 5,790, family EINSAS4, 1 seat left).
 *
 * IMPERVAr: both www.srilankan.com GET and book.srilankan.com are Imperva
 * (Incapsula) gated from datacenter IPs (sandbox GET = 212B stub,
 * book.* POST = "Pardon Our Interruption"). Per the MMT pattern the worker
 * is a self-detecting full-flow probe: it replays the chain on every search
 * and honestly reports ACCESS_CHALLENGE while gated; a clean production IP
 * (Hostinger) activates it automatically. NEVER fabricate data while gated.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const SL_HOME = 'https://www.srilankan.com/en_uk/ca';
export const SL_OVERRIDE_POST = 'https://www.srilankan.com/en_uk/home/srilakan-override';
export const SL_IBE_OVERRIDE = 'https://book.srilankan.com/plnext/srilankanairDX/Override.action?';
export const SL_IBE_SITE = 'CBGVCNEW';

/** True when a response body is the Imperva/Incapsula interstitial. */
export function slIsImpervaStub(body: string): boolean {
  return /_Incapsula_Resource|Pardon Our Interruption/i.test(body || '');
}

/** Extract the idxxui anti-bot token from the homepage HTML. */
export function slIdxxui(homeHtml: string): string {
  const m = (homeHtml || '').match(/id="idxxui"[^>]*value="([^"]+)"/) || (homeHtml || '').match(/name="idxxui"[^>]*value="([^"]+)"/);
  return m ? m[1] : '';
}

/** ISO (YYYY-MM-DD) -> widget selddate1 / fromdate. */
export function slDateParams(depIso: string): { selddate1: string; fromdate: string } {
  const m = depIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { selddate1: depIso, fromdate: depIso.replace(/-/g, '') + '0000' };
  return { selddate1: depIso, fromdate: `${m[1]}${m[2]}${m[3]}0000` };
}

/** The override POST body (urlencoded; replayed from the CDP capture). */
export function slOverrideBody(fromCode: string, toCode: string, fromLabel: string, toLabel: string, depIso: string, idxxui: string): string {
  const { selddate1, fromdate } = slDateParams(depIso);
  return new URLSearchParams({
    ffpOk: '', isredemption: 'F', promotracking: '', idxxui,
    sitelang: 'GB', from_result: '', to_result: '',
    seldcity1: fromCode, selacity1: toCode,
    suggest1: fromLabel, suggest2: toLabel, suggest1xx: '', suggest2xx: '',
    selddate1, seladate1: selddate1, selcabinclass: 'E',
    seladults: '1', selchildren: '0', selchildrenyoung: '0', selinfants: '0',
    key_arrivalairport: '', key_departureairport: '', key_promocode: '',
    tid: 'OW', tidtmp: '', ispromowidget: '0',
    fromdate, todate: fromdate, resultby: '1',
    isPayLaterRedeemVoucher: 'R', resultbyPayLater: '4', isCashPlusMiles: '5',
    flxDateCheck: '',
  }).toString();
}

/** Pull the server-generated ENC hex (>=100 hex chars) out of the override page. */
export function slEncFromOverridePage(html: string): string | null {
  const m = (html || '').match(/\b[A-F0-9]{100,}\b/);
  return m ? m[0] : null;
}

export interface SlFlight {
  flightNo: string;          // 'UL122'
  depTime: string;           // '09:50'
  arrTime: string;           // '11:10'
  depDateIso: string;        // '2026-10-28'
  fromCode: string;
  toCode: string;
  stops: number;
  aircraft: string;
}

/** 'Oct 28, 2026, 9:50:00 AM' -> { iso: '2026-10-28', hhmm: '09:50' } */
function slParseAmadeusDate(s: string): { iso: string; hhmm: string } | null {
  const m = String(s || '').match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/);
  if (!m) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mo = months.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (mo < 0) return null;
  let h = Number(m[4]) % 12;
  if (m[7] === 'PM') h += 12;
  return {
    iso: `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`,
    hhmm: `${String(h).padStart(2, '0')}:${m[5]}`,
  };
}

/**
 * Extract the business.Availability JSON island from a pl-next availability
 * page and decode flights + cheapest outbound recommendation.
 * Shape-tolerant: brace-matches the object that contains "proposedBounds".
 */
export function parseSriLankanAvailability(html: string, depIso: string): { flights: SlFlight[]; cheapestFare: number; fareFamily: string; tax: number; base: number; seats: number } | null {
  const b = html || '';
  const i = b.indexOf('"proposedBounds":');
  if (i < 0) return null;
  // walk back to the object that opens this data island
  let k = i, depth = 0, start = -1;
  while (k > 0) {
    const c = b[k];
    if (c === '}') depth += 1;
    else if (c === '{') {
      if (depth === 0) { start = k; break; }
      depth -= 1;
    }
    k -= 1;
  }
  if (start < 0) return null;
  let end = start; depth = 0;
  while (end < b.length) {
    const c = b[end];
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) break; }
    end += 1;
  }
  let d: any;
  try { d = JSON.parse(b.slice(start, end + 1)); } catch { return null; }

  // flights from the first (outbound) bound
  const flights: SlFlight[] = [];
  const bounds = Array.isArray(d.proposedBounds) ? d.proposedBounds : [];
  const grp = bounds[0]?.proposedFlightsGroup || [];
  for (const g of grp) {
    const segs = g.segments || [];
    const first = segs[0];
    const last = segs[segs.length - 1];
    if (!first || !last) continue;
    const dep = slParseAmadeusDate(first.beginDate);
    const arr = slParseAmadeusDate(last.endDate);
    if (!dep || !arr) continue;
    if (dep.iso !== depIso) continue; // honest exact-date rows only
    const alCode = String(first.airline?.code || 'UL');
    const no = String(first.flightNumber || '');
    if (!no) continue;
    flights.push({
      flightNo: `${alCode}${no}`,
      depTime: dep.hhmm,
      arrTime: arr.hhmm,
      depDateIso: dep.iso,
      fromCode: String(first.beginLocation?.locationCode || ''),
      toCode: String(last.endLocation?.locationCode || ''),
      stops: Number(last.nbrOfStops ?? 0),
      aircraft: String(first.equipment?.code || first.equipment || ''),
    });
  }
  if (!flights.length) return null;

  // cheapest recommendation for the outbound bound (bound index 0)
  let cheapestFare = 0, tax = 0, base = 0, seats = 0;
  let fareFamily = '';
  for (const rec of d.recommendationList || []) {
    const bound = rec.bounds?.[0];
    const amt = bound?.boundAmount;
    const total = Number(amt?.totalAmount ?? 0);
    if (!(total > 0)) continue;
    const s = Number(bound?.flightGroupList?.[0]?.numberOfSeatsLeft ?? 0);
    if (cheapestFare === 0 || total < cheapestFare) {
      cheapestFare = Math.round(total);
      tax = Math.round(Number(amt.tax ?? 0));
      base = Math.round(Number(amt.amountWithoutTaxAndFee ?? amt.amountWithoutTax ?? 0));
      seats = s;
      fareFamily = String(bound?.ffCode || rec.ffCode || '');
    }
  }
  if (cheapestFare <= 0) return null;
  return { flights, cheapestFare, fareFamily, tax, base, seats };
}

/** Honest per-flight rows (airline-direct seller, IBE deeplink). */
export function sriLankanFlightItems(
  flights: SlFlight[],
  cheapestFare: number,
  fareFamily: string,
  tax: number,
  base: number,
  seats: number,
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const srpUrl = `${SL_HOME}`; // the widget chain pre-fills the IBE; deep link is the homepage widget
  return flights.map((f) => newRawItem(source, {
    title: `SriLankan Airlines ${f.flightNo} ${fromCity} → ${toCity} on ${f.depDateIso} from ₹${cheapestFare} (${f.depTime}–${f.arrTime})`,
    brand: 'SriLankan Airlines',
    price: cheapestFare,
    currency: 'INR',
    seller: 'SriLankan Airlines',
    sellerUrl: srpUrl,
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: f.depDateIso },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: 'SriLankan Airlines',
      flight_number: f.flightNo,
      travel_date: f.depDateIso,
      departure_date: f.depDateIso,
      departure: f.depTime,
      arrival: f.arrTime,
      stops: String(f.stops),
      ...(f.aircraft ? { aircraft: f.aircraft } : {}),
      ...(fareFamily ? { fare_class: `${fareFamily} (lowest available fare family incl. taxes)` } : {}),
      ...(seats ? { seats: `${seats} seats left at this fare` } : {}),
      price_basis: `SriLankan booking-engine fare for 1 adult on ${f.depDateIso} (base ₹${base} + taxes ₹${tax}) captured ${today}`,
      data_note: `Fare and schedule from SriLankan Airlines' own Amadeus booking engine on ${today}; booking continues on SriLankan's own website. Fare may change at checkout.`,
      image: '',
    },
    identifiers: { sku: `ul-${f.flightNo}-${f.depDateIso}-${f.fromCode}${f.toCode}`.replace(/\s+/g, '') },
    evidence: {
      sourceUrl: SL_IBE_OVERRIDE,
      extractedFields: ['proposedBounds[].proposedFlightsGroup[].segments[]', 'recommendationList[].bounds[0].boundAmount.totalAmount (INR)'],
    },
  }));
}
