/**
 * Merchant deep-link builders (owner 27 Oct: "kuch website pr deeplink ho raha hai
 * par kuch pr ni — sb pr ho jaye").
 *
 * Every merchant in the confirmed source registry gets a REAL destination:
 * product/search/SRP pages with the user's own query, route and dates prefilled —
 * never a bare homepage. When a merchant has no stable query contract, the link
 * points at that merchant's own search/product category page (still deeper than
 * the homepage).
 *
 * Travel context comes from the offer itself (route "indore to delhi", ISO date),
 * so a flight row links to that exact route/date on every seller, not to "/".
 */

export interface TravelCtx {
  route?: string;
  date?: string;
  city?: string;
  /** Return date (ISO) for stay verticals — nights are computed from date→return. */
  return?: string;
}

const IATA: Record<string, string> = {
  // shared subset used by the airline/OTA SRPs
  delhi: 'DEL', 'new delhi': 'DEL', mumbai: 'BOM', bengaluru: 'BLR', bangalore: 'BLR',
  hyderabad: 'HYD', chennai: 'MAA', kolkata: 'CCU', pune: 'PNQ', ahmedabad: 'AMD',
  goa: 'GOI', jaipur: 'JAI', lucknow: 'LKO', indore: 'IDR', bhopal: 'BHO', patna: 'PAT',
  chandigarh: 'IXC', kochi: 'COK', coimbatore: 'CJB', varanasi: 'VNS', nagpur: 'NAG',
  surat: 'STV', visakhapatnam: 'VTZ', bhubaneswar: 'BBI', guwahati: 'GAU', srinagar: 'SXR',
  dibrugarh: 'DIB', ranchi: 'IXR', raipur: 'RPR', trivandrum: 'TRV', amritsar: 'ATQ',
  udaipur: 'UDR', manali: 'KUU', dehradun: 'DED', bagdogra: 'IXB', madurai: 'IXM',
};

const cityCode = (name?: string): string => IATA[String(name || '').toLowerCase().trim()] || '';

const slug = (s: string): string =>
  String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);

interface Dates {
  iso: string; ymd: string; dmy: string; dMonY: string; dd: string; mm: string; yyyy: string;
}

function dates(d?: string): Dates | null {
  const s = String(d || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { iso: s, ymd: `${yyyy}${mm}${dd}`, dmy: `${dd}/${mm}/${yyyy}`, dMonY: `${dd}-${months[Number(mm) - 1] || 'Jan'}-${yyyy}`, dd, mm, yyyy };
}

function route(t?: string): { from: string; to: string } | null {
  const legs = String(t || '').split(/\s+to\s+/i);
  if (legs.length !== 2) return null;
  const from = legs[0].trim();
  const to = legs[1].trim();
  return from && to ? { from, to } : null;
}

/** City for hotel SRPs: explicit city, a single-leg "route", or the first city word in the title. */
function hotelCity(title: string, ctx: TravelCtx): string {
  if (ctx.city) return String(ctx.city).trim();
  const r = route(ctx.route);
  if (!r) {
    const single = String(ctx.route || '').trim();
    if (single && !/\s/.test(single)) return single;
  } else if (r.to) {
    return r.to;
  }
  const m = String(title || '').match(/\b(?:hotels?|stays?)\s+in\s+([a-z\s]{3,24})/i);
  return m ? m[1].trim() : '';
}

const e = encodeURIComponent;

/**
 * Returns a deep link for `merchant`, or '' when the merchant is unknown (the
 * caller then keeps whatever URL the offer carried).
 */
export function merchantDeepLink(merchant: string, title: string, vertical?: string, ctx: TravelCtx = {}): string {
  const v = String(merchant || '').toLowerCase();
  if (!v) return '';
  // No product name and no travel context: inventing a destination would be a
  // guessed link, so the caller keeps the offer's own URL (legacy contract).
  if (!String(title || '').trim() && !String(ctx.route || '').trim() && !String(ctx.city || '').trim()) return '';
  const has = (...keys: string[]) => keys.some((k) => v.includes(k));
  const q = e(String(title || '').trim().slice(0, 80));
  const t = String(title || '').trim();
  const r = route(ctx.route);
  const d = dates(ctx.date);
  const city = hotelCity(t, ctx);
  const cq = city ? e(city) : '';
  const from = r ? (cityCode(r.from) || r.from) : '';
  const to = r ? (cityCode(r.to) || r.to) : '';

  // ---------------- e-commerce ----------------
  if (has('amazon')) return `https://www.amazon.in/s?k=${q}`;
  if (has('flipkart') && has('minute')) return `https://www.flipkart.com/search?q=${q}&marketplace=GROCERY`;
  if (has('flipkart')) return `https://www.flipkart.com/search?q=${q}`;
  if (has('meesho')) return `https://www.meesho.com/search?q=${q}`;
  if (has('myntra')) return `https://www.myntra.com/${slug(t)}`;
  if (has('ajio')) return `https://www.ajio.com/search/?text=${q}`;
  if (has('tata') && has('cliq')) return `https://www.tatacliq.com/search/?searchCategory=all&text=${q}`;
  if (has('nykaa')) return `https://www.nykaa.com/search/result/?q=${q}`;
  if (has('croma')) return `https://www.croma.com/searchB?q=${q}`;
  if (has('xiaomi') || has('mi.com')) return `https://www.mi.com/in/search/?keyword=${q}`;
  if (has('oppo')) return `https://www.oppo.com/in/search/?q=${q}`;
  if (has('realme')) return `https://www.realme.com/in/search?keyword=${q}`;
  if (has('lenovo')) return `https://www.lenovo.com/in/en/search?fq=${q}`;

  // ---------------- 10-min grocery ----------------
  if (has('instamart')) return `https://www.swiggy.com/instamart/search?query=${q}`;
  if (has('blinkit')) return `https://blinkit.com/s/?q=${q}`;
  if (has('zepto')) return `https://www.zepto.com/search?query=${q}`;
  if (has('bigbasket', 'bb now', 'bbnow')) return `https://www.bigbasket.com/ps/?q=${q}`;

  // ---------------- food ----------------
  if (has('swiggy')) return `https://www.swiggy.com/search?query=${q}`;
  if (has('zomato')) return `https://www.zomato.com/search?query=${q}`;
  if (has('domino')) return `https://www.dominos.co.in/menu`;
  if (has('ovenstory', 'oven story')) return `https://www.ovenstory.in/menu`;
  if (has('eatsure', 'eat sure')) return `https://www.eatsure.com/search?q=${q}`;

  // ---------------- movies ----------------
  if (has('bookmyshow', 'book my show')) return city ? `https://in.bookmyshow.com/explore/movies-${slug(city)}` : 'https://in.bookmyshow.com/explore/movies';
  if (has('district')) return 'https://www.district.in/movies';
  if (has('paytm')) return 'https://paytm.com/movies/';
  if (has('pvr')) return 'https://www.pvrcinemas.com/';
  if (has('cinepolis')) return 'https://www.cinepolisindia.com/';
  if (has('ticketnew', 'ticket new')) return 'https://www.ticketnew.com/';

  // ---------------- flights ----------------
  if (!has('hotel') && (vertical === 'flights' || has('air', 'airline', 'goindigo', 'indigo', 'akasa', 'spicejet', 'vistara'))) {
    const dd = d ? d.dmy : '';
    const isoD = d ? d.iso : '';
    const ymd = d ? d.ymd : '';
    if (has('makemytrip')) {
      if (from && to && d && cityCode(r!.from) && cityCode(r!.to)) {
        return `https://www.makemytrip.com/flight/search?itinerary=${e(`${from}-${to}-${d.dd}/${d.mm}/${d.yyyy}`)}&tripType=O&paxType=1-A-C&intl=false&cabinClass=E&cc=INR`;
      }
      return 'https://www.makemytrip.com/flights/';
    }
    if (has('easemytrip', 'ease my trip')) {
      return from && to && dd ? `https://www.easemytrip.com/flight-search/?from=${e(from)}&to=${e(to)}&ddate=${e(dd)}` : 'https://www.easemytrip.com/flights.html';
    }
    if (has('ixigo')) {
      // Owner 29 Oct ("ixigo blank page after redirection"): /flights?from=..&to=..&depart=..
      // is ixigo's MARKETING landing page — it answers 200 with no itinerary and renders
      // an empty shell in the in-app browser. The path their own results live on (and the
      // one our flights worker scrapes) is /search/flight/<from>/<to>/<ISO date>/1/0.
      // Verified live: 592KB of real Indore→Delhi results, fares on the page.
      return from && to && isoD ? `https://www.ixigo.com/search/flight/${e(from)}/${e(to)}/${e(isoD)}/1/0` : 'https://www.ixigo.com/flights';
    }
    if (has('yatra')) {
      return from && to && dd ? `https://www.yatra.com/flight/search?flight-type=on&from=${e(from)}&to=${e(to)}&departDate=${e(dd)}&adults=1&child=0&infant=0&class=Economy&flexi=0` : 'https://www.yatra.com/flights';
    }
    if (has('cleartrip')) {
      return from && to && isoD ? `https://www.cleartrip.com/flights/results?from=${e(from)}&to=${e(to)}&depart_date=${isoD}&adults=1&childs=0&infants=0&class=Economy` : 'https://www.cleartrip.com/flights';
    }
    if (has('akasa')) {
      return from && to && isoD ? `https://www.akasaair.com/booking/search?from=${e(from)}&to=${e(to)}&date=${isoD}&adults=1` : 'https://www.akasaair.com/';
    }
    if (has('goindigo', 'indigo')) {
      return from && to && isoD ? `https://www.goindigo.in/booking.html?from=${e(from)}&to=${e(to)}&date=${isoD}` : 'https://www.goindigo.in/booking.html';
    }
    // LIVE-CHECKED 27 Oct: these carriers' booking entry pages answer 200; the live
    // availability itself is behind their own (bot-gated) booking flow, so we link
    // the booking page rather than fabricating a query string they don't accept.
    if (has('emirates')) return 'https://www.emirates.com/in/english/book/';
    if (has('qatar')) return 'https://www.qatarairways.com/en-in/book.html';
    if (has('singapore')) return 'https://www.singaporeair.com/en_UK/in/plan-travel/';
    if (has('airindia', 'air india')) return 'https://www.airindia.com/';
  }

  // ---------------- bus ----------------
  if (vertical === 'bus' || has('bus')) {
    if (has('redbus')) {
      return r ? `https://www.redbus.in/bus-tickets/${slug(r.from)}-to-${slug(r.to)}${d ? `?onward=${e(d.dMonY)}` : ''}` : 'https://www.redbus.in/bus-tickets';
    }
    if (has('intrcity', 'intr city')) return 'https://www.intrcity.com/';
    if (has('zingbus')) {
      // zingbus publishes one SEO route page per city pair (verified pattern used by
      // its own parser: /bus-tickets/<from>-to-<to>-bus-route).
      return r ? `https://www.zingbus.com/bus-tickets/${slug(r.from)}-to-${slug(r.to)}-bus-route` : 'https://www.zingbus.com/';
    }
    if (has('abhibus')) {
      return r ? `https://www.abhibus.com/bus_search/${slug(r.from)}/${slug(r.to)}/${d ? d.iso : ''}/1` : 'https://www.abhibus.com/';
    }
    if (has('ixigo')) {
      return r ? `https://www.ixigo.com/buses/${slug(r.from)}-to-${slug(r.to)}${d ? `-${d.ymd}` : ''}` : 'https://www.ixigo.com/buses';
    }
    if (has('yatra')) {
      return r ? `https://www.yatra.com/bus/search?from=${e(r.from)}&to=${e(r.to)}${d ? `&date=${e(d.dmy)}` : ''}` : 'https://www.yatra.com/bus';
    }
    if (has('makemytrip')) {
      return r && d ? `https://www.makemytrip.com/bus/search/${slug(r.from)}/${slug(r.to)}/${d.dd}-${d.mm}-${d.yyyy}` : 'https://www.makemytrip.com/bus/';
    }
  }

  // ---------------- hotels ----------------
  if (vertical === 'hotels' || has('hotel', 'stay', 'rooms', 'oyo')) {
    const ci = d ? d.iso : '';
    // Owner 1 Nov ("deeplink galat page par le jata hai"): every stay link used a
    // hardcoded 1 night, so a 19-21 Nov search opened a 19-20 Nov page and the OTA
    // showed other/empty rates. The real checkout follows the request's return date,
    // and nights = checkout - checkin (default 1 night only when no return was asked).
    const nights = (() => {
      if (!d) return 0;
      const r0 = dates(ctx.return);
      if (r0) {
        const a = Date.parse(`${d.iso}T00:00:00Z`);
        const b = Date.parse(`${r0.iso}T00:00:00Z`);
        const n = Math.round((b - a) / 86_400_000);
        if (Number.isFinite(n) && n > 0) return Math.min(n, 30);
      }
      return 1;
    })();
    const co = (() => {
      if (!d) return '';
      if (nights > 0) {
        const dt = new Date(`${d.iso}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() + nights);
        return dt.toISOString().slice(0, 10);
      }
      const dt = new Date(`${d.iso}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + 1);
      return dt.toISOString().slice(0, 10);
    })();
    // Global OTAs + chains from the acceptance registry (marked "mandated").
    // LIVE-CHECKED 27 Oct: hotwire/destinia/tiket/lastminute/ihg answer 200 with the
    // city in the URL; hotels.com/orbitz return 429 (rate-limit, same pattern their
    // own search uses); marriott/hilton/traveloka are bot-gated (403) — their search
    // entry pages are linked, never a fabricated payload. hostelworld/happyeasygo
    // resolve only at their search home, so that is what we link.
    if (has('hotels.com')) return `https://www.hotels.com/Hotel-Search?destination=${cq || 'Goa'}${ci ? `&startDate=${ci}&endDate=${co}` : ''}&adults=2`;
    if (has('hotwire')) return `https://www.hotwire.com/hotels/search?destination=${cq}${ci ? `&startDate=${ci}&endDate=${co}` : ''}`;
    if (has('orbitz')) return `https://www.orbitz.com/Hotel-Search?destination=${cq}${ci ? `&startDate=${ci}&endDate=${co}` : ''}`;
    if (has('traveloka')) return 'https://www.traveloka.com/en-in/hotel';
    if (has('hostelworld')) return 'https://www.hostelworld.com/';
    if (has('destinia')) return 'https://www.destinia.com/hotels';
    if (has('tiket')) return 'https://www.tiket.com/en-us/hotel';
    if (has('lastminute')) return 'https://www.lastminute.com/hotels';
    if (has('marriott')) return `https://www.marriott.com/search/findHotels.mi${city ? `?destinationAddress.destination=${cq}` : ''}`;
    if (has('hilton')) return `https://www.hilton.com/en/search/${city ? `?q=${cq}` : ''}`;
    if (has('ihg')) return 'https://www.ihg.com/hotels/us/en/reservation';
    if (has('happyeasygo', 'happy easy go')) return 'https://www.happyeasygo.com/';
    if (has('makemytrip')) {
      return city ? `https://www.makemytrip.com/hotels/hotel-listing/?city=${e(city.toUpperCase())}${ci ? `&checkin=${d!.ymd}&checkout=${co.replace(/-/g, '')}` : ''}` : 'https://www.makemytrip.com/hotels/';
    }
    if (has('goibibo')) {
      return city ? `https://www.goibibo.com/hotels/find-hotels-in-${slug(city)}/${ci && co ? `?checkin=${d!.ymd}&checkout=${co.replace(/-/g, '')}` : ''}` : 'https://www.goibibo.com/hotels/';
    }
    if (has('booking')) {
      return city ? `https://www.booking.com/searchresults.html?ss=${cq}${ci ? `&checkin=${ci}&checkout=${co}` : ''}&group_adults=2&no_rooms=1&group_children=0` : 'https://www.booking.com/searchresults.html';
    }
    if (has('agoda')) {
      return city
        ? `https://www.agoda.com/search?q=${cq}${ci ? `&checkIn=${ci}&checkOut=${co}&los=${nights || 1}&adults=2&rooms=1` : ''}`
        : 'https://www.agoda.com/';
    }
    if (has('yatra')) {
      return city
        ? `https://www.yatra.com/hotels/hotels-in-${slug(city)}${ci ? `?checkin=${d!.dmy.replace(/\//g, '-')}&checkout=${co.split('-').reverse().join('-')}&rooms=1&adults=2` : ''}`
        : 'https://www.yatra.com/hotels';
    }
    if (has('cleartrip')) {
      return city
        ? `https://www.cleartrip.com/hotels/india/${slug(city)}-hotels${ci ? `?checkin=${d!.dmy.replace(/\//g, '-')}&checkout=${co.split('-').reverse().join('-')}&rooms=1&adults=2` : ''}`
        : 'https://www.cleartrip.com/hotels';
    }
    if (has('easemytrip', 'ease my trip')) {
      // OWNER 3 Nov ("redirection ke baad something went wrong / error"). MEASURED: the old
      // ?city=Shimla-only listing URL answers a hard 404 Error page. The listing route needs the
      // cin/cout date pair, which answers 200 with the real Shimla results:
      //   /hotels/hotel-listing/?city=Shimla&cin=20-11-2026&cout=22-11-2026&rooms=1&guests=2 -> 200, 206KB
      const emtCi = d ? d.dmy.replace(/\//g, '-') : '';
      const emtCo = co ? co.split('-').reverse().join('-') : '';
      return city
        ? `https://www.easemytrip.com/hotels/hotel-listing/?city=${cq}${emtCi ? `&cin=${emtCi}&cout=${emtCo}&rooms=1&guests=2` : ''}`
        : 'https://www.easemytrip.com/hotels/';
    }
    if (has('oyo')) {
      // OWNER 3 Nov: "redirection ke baad site jaise ki oyo wagera something went wrong de raha hai".
      // MEASURED: oyorooms.com/search?location=Shimla 301s to /search/ and serves the US locale page
      // (title "OYO Hotels USA"), whose app shell renders its "something went wrong" state - the
      // search route is locale/geo broken for India. The city landing route works: /hotels-in-shimla/
      // with the same checkin/checkout answered 200, 242KB, "Hotels in Shimla Starting @ Rs 1003".
      return city
        ? `https://www.oyorooms.com/hotels-in-${slug(city)}/${ci ? `?checkin=${ci}&checkout=${co}&rooms=1&guests=2` : ''}`
        : 'https://www.oyorooms.com/';
    }
    if (has('saffron')) {
      return city ? `https://www.saffronstays.com/search?q=${cq}` : 'https://www.saffronstays.com/';
    }
  }

  // ---------------- cab ----------------
  if (vertical === 'cab' || has('cab', 'ride', 'taxi', 'ola', 'uber')) {
    if (has('uber')) return 'https://m.uber.com/looking';
    if (has('ola')) return 'https://book.olacabs.com/';
    if (has('indrive', 'in drive')) return 'https://indrive.com/';
    if (has('meru')) return 'https://www.meru.in/';
    if (has('fastdeal', 'snap')) return 'https://www.fastdeals.in/';
    if (has('blusmart', 'blu smart')) return 'https://blusmart.in/';
    if (has('rapido')) {
      const lat = ctx.city ? '' : '';
      return `https://m.rapido.bike/${lat}`.replace(/\/$/, '');
    }
  }

  // ---------------- finance ----------------
  const loanish = /loan|credit\s*card|personal\s*loan|home\s*loan/i.test(`${t} ${vertical || ''}`);
  const insurish = /insurance|policy|cover/i.test(`${t} ${vertical || ''}`);
  // Product-specific pages: a "car insurance" row must land on that product, not "/".
  const insKind = /two\s*wheeler|bike|scooter/i.test(t) ? 'bike'
    : /car|motor|vehicle/i.test(t) ? 'car'
    : /health|mediclaim|hospital/i.test(t) ? 'health'
    : /term|life/i.test(t) ? 'life'
    : /travel/i.test(t) ? 'travel' : '';
  const loanKind = /home\s*loan/i.test(t) ? 'home-loan'
    : /car\s*loan|auto\s*loan/i.test(t) ? 'car-loan'
    : /business\s*loan/i.test(t) ? 'business-loan'
    : /credit\s*card/i.test(t) ? 'credit-card'
    : 'personal-loan';
  if (loanish || insurish || vertical === 'loans' || vertical === 'insurance' || vertical === 'creditcards') {
    if (has('paisabazaar')) return insurish ? `https://www.paisabazaar.com/insurance/${insKind ? insKind + '-insurance/' : ''}` : `https://www.paisabazaar.com/${loanKind}/`;
    if (has('bankbazaar')) return insurish ? 'https://www.bankbazaar.com/insurance.html' : `https://www.bankbazaar.com/${loanKind}.html`;
    if (has('policybazaar')) return insurish ? `https://www.policybazaar.com/insurance/${insKind ? insKind + '-insurance/' : ''}` : 'https://www.policybazaar.com/';
    if (has('moneyview', 'money view')) return 'https://moneyview.in/loans';
    if (has('kreditbee', 'kredit bee')) return 'https://www.kreditbee.in/';
    if (has('navi')) return 'https://navi.com/loans';
    if (has('ditto')) return 'https://joinditto.in/health-insurance/';
    if (has('insurancedekho', 'insurance dekho')) return insKind ? `https://www.insurancedekho.com/${insKind}-insurance` : 'https://www.insurancedekho.com/';
    if (has('acko')) return insKind ? `https://www.acko.com/${insKind}-insurance/` : 'https://www.acko.com/';
    if (has('godigit', 'digit')) return insKind ? `https://www.godigit.com/${insKind}-insurance` : 'https://www.godigit.com/';
    if (has('coverfox')) return insKind ? `https://www.coverfox.com/${insKind}-insurance/` : 'https://www.coverfox.com/';
    if (has('cashe')) return 'https://www.cashe.co.in/';
    if (has('mpokket', 'm pokket')) return 'https://www.mpokket.in/';
  }

  // ---------------- generic OTA fallbacks (still deeper than homepage) ------
  if (has('makemytrip')) return 'https://www.makemytrip.com/';
  return '';
}

/** True when the link points at a real destination page rather than a bare homepage. */
export function isDeepLink(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    const hasQuery = u.search.length > 1;
    return path.length > 0 || hasQuery;
  } catch {
    return false;
  }
}

/* ===================== MOVIES: theatre-level links ===================== */

export interface MovieCtx {
  /** city as the user searched it ("Indore") */
  city?: string;
  /** ISO date YYYY-MM-DD the showtimes belong to */
  date?: string;
  /** gw cinema id (District/TicketNew sessions gateway) */
  cinemaId?: number | string;
  /** theatre name as published by the source */
  theatre?: string;
}

/**
 * Theatre-level movie deeplink (owner 27 Oct: "book krne ke baad ussi theatre pr
 * land hona chahiye, dobara search na karna pade").
 *
 * LIVE-VERIFIED 27 Oct from production-style curl_cffi fetches:
 *  - TicketNew:  https://ticketnew.com/movies/{city}/cinemas/{cinemaId}  -> 200, showtimes
 *  - BookMyShow: canonical buytickets URL is built in the BMS parser (needs the
 *                BMS region code + event code, which only that parser has)
 *  - District:   no public venue URL resolves (both /movies/{city}/cinemas/{id} and
 *                the slug form 404) -> returns '' rather than a dead link
 *  - PVR / Cinepolis: bot-gated (403 / timeout) -> returns ''
 */
export function movieTheatreLink(merchant: string, ctx: MovieCtx = {}): string {
  const v = String(merchant || '').toLowerCase();
  const city = slug(ctx.city || '');
  const id = String(ctx.cinemaId ?? '').trim();
  if (!v) return '';
  if (v.includes('ticketnew') && city && id) return `https://ticketnew.com/movies/${city}/cinemas/${id}`;
  if (v.includes('bookmyshow') || v.includes('book my show')) {
    // Venue-level BMS links need the venue code from BMS's own showtimes payload;
    // the parser hands out the movie+city+date buytickets link instead.
    return '';
  }
  return '';
}

/** Movie-level link for a city+date when no venue-level page exists. */
export function movieCityLink(merchant: string, ctx: MovieCtx = {}): string {
  const v = String(merchant || '').toLowerCase();
  const city = slug(ctx.city || '');
  if (v.includes('bookmyshow') || v.includes('book my show')) {
    return ctx.city ? `https://in.bookmyshow.com/explore/movies-${city}` : 'https://in.bookmyshow.com/explore/movies';
  }
  if (v.includes('district')) return 'https://www.district.in/movies';
  if (v.includes('paytm')) return 'https://paytm.com/movies/';
  if (v.includes('ticketnew')) return city ? `https://ticketnew.com/movies/${city}/cinemas` : 'https://www.ticketnew.com/';
  return '';
}
