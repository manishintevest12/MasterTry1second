/**
 * Vertical Engines (Section 3): shared VerticalEngine base with per-vertical
 * config (required fields already enforced by ValidationEngine, Section 12),
 * freshness TTLs and any vertical-specific pre/post processing.
 * A vertical may use multiple sources; a source may serve multiple verticals.
 */
import type { NormalizedOffer, ParsedQuery, VerticalId } from '../types';

export interface VerticalEngineConfig {
  vertical: VerticalId;
  displayName: string;
  /** Post-processing hook applied after normalization, before ranking. */
  postProcess?: (offers: NormalizedOffer[], query: ParsedQuery) => NormalizedOffer[];
}

// Non-comparison verticals list merchant campaigns; browse queries there should not
// hard-filter legitimate feed offers (they surface ranked with truthful statuses).
const NON_COMPARISON_VERTICALS: string[] = [
  'coupons', 'giftcards', 'banking',
  // Listing/discovery verticals: the queried entity (dish, city, insurer, route) is not
  // part of the offer title, so title-token filtering would wrongly drop real results.
  'food', 'hotels', 'flights', 'bus', 'cab', 'insurance', 'loans', 'movies', 'creditcards',
];

function filterByQueryEntity(offers: NormalizedOffer[], query: ParsedQuery): NormalizedOffer[] {
  if (!query.entityName) return offers;
  const tokens = query.entityName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return offers;
  // Browse intent on a non-comparison vertical = "show me offers", not a product lookup.
  if ((query.intent === 'browse' || tokens.length > 2) && offers.length > 0 && offers.every((o) => NON_COMPARISON_VERTICALS.includes(o.vertical))) {
    return offers; // relevance still applied by ranking (title/vendor match)
  }
  return offers.filter((o) => {
    // Match against the title AND the vendor/merchant name
    const text = `${o.title} ${o.vendor || ''}`.toLowerCase();
    // At least half the significant query tokens should match
    const hits = tokens.filter((t) => text.includes(t)).length;
    return hits >= Math.ceil(tokens.length / 2);
  });
}


// ---------- Shared place/route matching (search must reflect what the user typed) ----------
const PLACE_ALIASES: Record<string, string> = {
  'new delhi': 'delhi', 'bengaluru': 'bangalore', 'bombay': 'mumbai', 'calcutta': 'kolkata',
  'madras': 'chennai', 'gurugram': 'gurgaon', 'poona': 'pune', 'baroda': 'vadodara',
};
const PLACE_NOISE = /\b(flight|flights|bus|buses|cab|cabs|taxi|ticket|tickets|book|booking|fare|fares|price|prices|from|cheapest|cheap|direct|return|one-way|oneway|airport|volvo|sleeper|ac|non-ac|hotel|hotels|in|near|around|at|on|for|tomorrow|today|tonight|night|morning|evening|next\s+\w+|this\s+\w+)\b/gi;
export function normPlace(x: string): { code?: string; city: string } {
  const code = x.match(/\(([A-Za-z]{3})\)/)?.[1]?.toLowerCase();
  let t = x.replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(PLACE_NOISE, ' ').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  t = PLACE_ALIASES[t] || t;
  return { code, city: t };
}
/** Extract {from,to} from free text like "patna to ranchi bus", "DEL → BOM", "from indore to bhopal". */
// Bare trailing IATA codes ("indore idr to delhi del") are rewritten to "City (IDR)".
const IATA_CODES = new Set(['DEL','BOM','BLR','HYD','MAA','CCU','PNQ','AMD','JAI','GOI','LKO','NAG','IDR','STV','PAT','BHO','CJB','COK','GAU','IXC','DED','ATQ','VNS','SXR','TRV','VTZ','IXM','UDR','JDH','IXR','RPR','BBI','IMF','IXL','IXB','IXU','IXE','BDQ','RAJ','IXJ','IXD','GOP','JRG','DIB','TEZ','KNU','MYQ','HBX','IXG','KLH','ISK','SAG','TIR','DXB','SIN','LHR','JFK','BKK','KUL','DOH','AUH','SHJ']);
export function withBracketedCodes(raw: string): string {
  return raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) =>
    IATA_CODES.has(code.toUpperCase()) && !/^(to|from|and|the|via)$/i.test(city) ? `${city} (${code.toUpperCase()})` : full);
}
export function parseRouteQuery(raw: string): { from: { code?: string; city: string }; to: { code?: string; city: string } } | null {
  raw = withBracketedCodes(raw);
  const m = raw.match(/([a-zA-Z][a-zA-Z\s.]{1,28}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z\s.]{1,28}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const from = normPlace(m[1].replace(/^\s*from\s+/i, '')), to = normPlace(m[2]);
  if (!from.city || !to.city) return null;
  return { from, to };
}
/**
 * Cab searches are route fares. When the user types only a LOCATION (e.g. "vijay nagar indore",
 * "Indore airport", "cab in indore") there is no destination, so no source can quote anything.
 * Resolve it to the city's standard outstation route (city -> nearest popular destination) so the
 * user still sees real fares; the route is shown in every result title. Never invents a price.
 */
const CAB_DEFAULT_DEST: Record<string, string> = {
  indore: 'Bhopal', bhopal: 'Indore', ujjain: 'Indore', delhi: 'Jaipur', mumbai: 'Pune', pune: 'Mumbai',
  bangalore: 'Mysore', bengaluru: 'Mysore', chennai: 'Pondicherry', hyderabad: 'Vijayawada', kolkata: 'Durgapur',
  ahmedabad: 'Vadodara', jaipur: 'Delhi', lucknow: 'Kanpur', chandigarh: 'Delhi', goa: 'Mumbai', nagpur: 'Raipur',
};
export function resolveCabQuery(raw: string, cityHint?: string): string {
  const q = String(raw || '').trim();
  if (!q) return q;
  if (parseRouteQuery(q)) return q; // already a route
  const text = (q + ' ' + (cityHint || '')).toLowerCase();
  // pick the first known city mentioned in the typed text (typed text wins over the profile city)
  const known = Object.keys(CAB_DEFAULT_DEST);
  const typed = q.toLowerCase();
  const city = known.find((c) => new RegExp(`\\b${c}\\b`).test(typed)) || known.find((c) => new RegExp(`\\b${c}\\b`).test(text));
  if (!city) return q;
  const dest = CAB_DEFAULT_DEST[city];
  const title = city.charAt(0).toUpperCase() + city.slice(1);
  return `${title} to ${dest}`;
}
function placeHit(text: string, side: { code?: string; city: string }): boolean {
  const s = (text || '').toLowerCase();
  const alias = Object.entries(PLACE_ALIASES).filter(([, v]) => v === side.city).map(([k]) => k);
  return !!((side.code && new RegExp(`\\b${side.code}\\b`, 'i').test(s)) || (side.city && (s.includes(side.city) || alias.some((a) => s.includes(a)))));
}
/** Keep only offers whose route matches the typed route (both ends). Offers with no route cannot prove relevance. */
export function routeFilter(offers: NormalizedOffer[], query: ParsedQuery): NormalizedOffer[] {
  const rt = parseRouteQuery(query.rawQuery || '');
  if (!rt) return offers;
  return offers.filter((o) => {
    const r = String(o.travel?.route || o.attributes?.['route'] || '').toLowerCase();
    if (!r) return false;
    const [src = '', dst = ''] = r.split(/\s+(?:to|→|->)\s+/);
    return placeHit(src, rt.from) && placeHit(dst, rt.to);
  });
}
/** Keep only offers located in the typed city/destination (hotels, food, grocery browse). */
export function destinationFilter(offers: NormalizedOffer[], query: ParsedQuery): NormalizedOffer[] {
  // "Indore, India" / "Goa, Goa, India": the destination is the part before the first comma; country and
  // state tails never help matching (offers say "Indore", not "Indore India").
  const head = String(query.rawQuery || '').split(',')[0];
  const q = normPlace(head);
  const city = (query.location?.city || '').toLowerCase();
  const target = q.city || city;
  if (!target) return offers;
  // Match on every spelling of the destination (Bengaluru = Bangalore, Gurugram = Gurgaon, Delhi = New Delhi).
  const names = new Set<string>([target]);
  for (const [k, v] of Object.entries(PLACE_ALIASES)) { if (v === target) names.add(k); if (k === target) names.add(v); }
  for (const g of [['delhi', 'new delhi'], ['mysuru', 'mysore'], ['puducherry', 'pondicherry'], ['prayagraj', 'allahabad'], ['kochi', 'cochin'], ['thiruvananthapuram', 'trivandrum'], ['mangaluru', 'mangalore'], ['visakhapatnam', 'vizag']]) {
    if (g.includes(target)) g.forEach((x) => names.add(x));
  }
  return offers.filter((o) => {
    const hay = `${o.location?.city || ''} ${o.attributes?.['destination'] || ''} ${o.attributes?.['city'] || ''} ${o.title}`.toLowerCase();
    for (const n of names) if (hay.includes(n)) return true;
    return false;
  });
}

function travelFilter(offers: NormalizedOffer[], query: ParsedQuery): NormalizedOffer[] {
  if (!query.travelDates?.depart) return offers;
  return offers.filter((o) => !o.travel?.date || o.travel.date === query.travelDates!.depart);
}

class VerticalEngine {
  constructor(public config: VerticalEngineConfig) {}

  async execute(offers: NormalizedOffer[], query: ParsedQuery): Promise<NormalizedOffer[]> {
    let out = offers.filter((o) => o.vertical === this.config.vertical);
    out = filterByQueryEntity(out, query);
    out = travelFilter(out, query);
    if (this.config.postProcess) out = this.config.postProcess(out, query);
    return out;
  }
}

// ------- The 13 vertical engines -------
class EcommerceEngine extends VerticalEngine {
  constructor() {
    super({
      vertical: 'ecommerce',
      displayName: 'E-Commerce / Shopping',
      postProcess: (offers, query) => {
        // Variant filtering: only offers matching the requested configuration are compared as the same product
        const cfg = query.configuration;
        if (!cfg) return offers;
        return offers.map((o) => {
          const attrs = o.attributes || {};
          let matchesConfig = true;
          for (const [k, v] of Object.entries(cfg)) {
            if (attrs[k] && attrs[k].toLowerCase() !== String(v).toLowerCase()) matchesConfig = false;
          }
          return { ...o, matchState: matchesConfig && o.matchState === 'MATCHED' ? 'MATCHED' : matchesConfig ? o.matchState : 'NOT_MATCHED' };
        });
      },
    });
  }
}

class FlightEngine extends VerticalEngine {
  constructor() {
    super({
      vertical: 'flights',
      displayName: 'Flights',
      // ONLY offers for the typed route may be shown (a cached Delhi->Mumbai fare must never
      // appear for a Patna->Delhi search).
      postProcess: (offers, query) => routeFilter(offers, query),
    });
  }
}

class HotelEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'hotels', displayName: 'Hotels', postProcess: (offers, query) => destinationFilter(offers, query).map((o) => {
      // Hotel prices are per night unless the source explicitly says otherwise
      return { ...o, attributes: { ...o.attributes, unit: o.attributes['unit'] || 'per night' } };
    }) });
  }
}

class CabEngine extends VerticalEngine {
  constructor() {
    super({
      vertical: 'cab',
      displayName: 'Cabs & Mobility',
      postProcess: (offers, query) => routeFilter(offers, query).map((o) => ({
        ...o,
        // Stale fares are never presented as guaranteed booking prices (Section 12)
        attributes: { ...o.attributes, fare_type: o.freshnessStatus === 'LIVE_VERIFIED' ? 'live_estimate' : 'indicative_only' },
      })),
    });
  }
}

class LoanEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'loans', displayName: 'Loans & Credit', postProcess: (offers) => offers.map((o) => ({
      ...o,
      // Indicative rates are distinguished from approved offers
      attributes: { ...o.attributes, rate_type: o.attributes['rate_type'] || 'indicative' },
    })) });
  }
}

class InsuranceEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'insurance', displayName: 'Insurance', postProcess: (offers) => offers.map((o) => ({
      ...o,
      attributes: { ...o.attributes, quote_type: o.attributes['quote_type'] || 'indicative' },
    })) });
  }
}

class CreditCardEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'creditcards', displayName: 'Credit Cards', postProcess: (offers) => offers.map((o) => ({
      ...o,
      attributes: { ...o.attributes, rate_type: o.attributes['rate_type'] || 'published', quote_type: 'published_terms' },
    })) });
  }
}

class MovieEventEngine extends VerticalEngine {
  constructor() { super({ vertical: 'movies', displayName: 'Movies & Events' }); }
}
class BusEngine extends VerticalEngine {
  constructor() { super({ vertical: 'bus', displayName: 'Bus Travel', postProcess: (offers, query) => routeFilter(offers, query) }); }
}
class FoodDeliveryEngine extends VerticalEngine {
  constructor() { super({ vertical: 'food', displayName: 'Food Delivery' }); }
}
class QuickGroceryEngine extends VerticalEngine {
  constructor() { super({ vertical: 'grocery', displayName: 'Quick Grocery' }); }
}
class CouponEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'coupons', displayName: 'Coupons & Promo Codes', postProcess: (offers) => offers.filter((o) => {
      // Unverified coupons surface but flagged; expired ones never do
      return o.freshnessStatus !== 'EXPIRED';
    }) });
  }
}
class GiftCardEngine extends VerticalEngine {
  constructor() { super({ vertical: 'giftcards', displayName: 'Gift Cards' }); }
}
class BankingOfferEngine extends VerticalEngine {
  constructor() { super({ vertical: 'banking', displayName: 'Credit Card & Banking Offers' }); }
}

const ENGINES: Record<VerticalId, VerticalEngine> = {
  ecommerce: new EcommerceEngine(),
  flights: new FlightEngine(),
  hotels: new HotelEngine(),
  cab: new CabEngine(),
  loans: new LoanEngine(),
  insurance: new InsuranceEngine(),
  creditcards: new CreditCardEngine(),
  movies: new MovieEventEngine(),
  bus: new BusEngine(),
  food: new FoodDeliveryEngine(),
  grocery: new QuickGroceryEngine(),
  coupons: new CouponEngine(),
  giftcards: new GiftCardEngine(),
  banking: new BankingOfferEngine(),
};

export function getVerticalEngine(vertical: VerticalId): VerticalEngine {
  return ENGINES[vertical];
}

export function verticalStatusReport(): Array<{ vertical: VerticalId; displayName: string; engineImplemented: true; note: string }> {
  // All 13 engines exist; operational status depends on configured+verified sources (honest reporting)
  return Object.values(ENGINES).map((e) => ({
    vertical: e.config.vertical,
    displayName: e.config.displayName,
    engineImplemented: true as const,
    note: 'Engine implemented; operational status depends on configured and verified sources for this vertical',
  }));
}
