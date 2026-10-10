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
const NON_COMPARISON_VERTICALS: string[] = ['coupons', 'giftcards', 'banking'];

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
      postProcess: (offers, query) => {
        // Route must match query route if both are expressed
        const routeMatch = query.rawQuery.match(/([a-z]+)\s+to\s+([a-z]+)/i);
        if (!routeMatch) return offers;
        const from = routeMatch[1].toLowerCase(), to = routeMatch[2].toLowerCase();
        return offers.filter((o) => {
          const r = (o.travel?.route || '').toLowerCase();
          return !r || (r.includes(from) && r.includes(to));
        });
      },
    });
  }
}

class HotelEngine extends VerticalEngine {
  constructor() {
    super({ vertical: 'hotels', displayName: 'Hotels', postProcess: (offers) => offers.map((o) => {
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
      postProcess: (offers) => offers.map((o) => ({
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

class MovieEventEngine extends VerticalEngine {
  constructor() { super({ vertical: 'movies', displayName: 'Movies & Events' }); }
}
class BusEngine extends VerticalEngine {
  constructor() { super({ vertical: 'bus', displayName: 'Bus Travel' }); }
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
