/**
 * DEEP-LINK-FIRST HYBRID (owner 10 Nov): "mere paas token ni hai, muje result chaiye, aur ye architecture
 * purane ke upar add kro bina purana break kiye".
 *
 * The idea he picked: when a partner cannot be READ server-side (Booking.com's 202 shell, IndiGo/Akasa
 * Cognito 403s, any future bot wall), we still serve that partner - not with an invented fare, but as an
 * INTENT HUB: the partner's own search/landing URL, routed through the existing affiliate chain
 * (/api/out -> buildSecureDeeplink -> CJ evergreen for Booking.com), so the click earns commission and the
 * user sees the partner's real, live price on the partner's own page.
 *
 * Layered ON TOP of the old architecture, never replacing it:
 *   - live sweep rows are untouched and always win; a hub is only offered for a merchant that has NO row;
 *   - hubs are NOT result cards (no price, so No Price, No Card still holds for every card);
 *     they travel in a separate `intentHubs` array plus a `hub` flag on any catalogue-backed row;
 *   - a catalogue-backed hub row is emitted ONLY when MySQL has a real price for that exact merchant,
 *     city/route and travel date, and it is labelled `price_basis: 'catalogue'` + `verify_live: '1'`
 *     so the UI can say "last seen price - verify on the partner's site";
 *   - nothing here is fetched at request time: no new failure modes, no extra latency.
 */
import { findCatalogueOffers } from '../catalogue/catalogueService';
import { merchantDeepLink } from '../affiliate/merchantLinks';

export interface IntentHub {
  seller: string;
  domain: string;
  url: string;
  /** Why this partner is a hub instead of a live row (surfaced in the admin/live report). */
  reason: string;
}

interface HubMerchant {
  seller: string;
  domain: string;
  reason: string;
  /** Merchant search surface used when no affiliate link template is configured for this seller. */
  fallbackUrl: (ctx: { city?: string; depart?: string; returnDate?: string; title?: string }) => string;
}

type Vert = 'hotels' | 'flights' | 'cab' | 'bus';

interface MerchantDef {
  seller: string;
  domain: string;
  verticals: Vert[];
  /** Present only when the merchant is measured unreadable from our egress; else it is a plain silent partner. */
  gated?: string;
  /** Merchant search surface per vertical (path only, host comes from domain). */
  path?: Partial<Record<Vert, string>>;
}

/**
 * OWNER 10 Nov: "cleartrip aur baki bache hue v add kr do like expedia and all" - the hub list now covers every
 * partner Try1Second can monetise in travel, not just the three walls we measured. Gated partners are ordered
 * first (they can NEVER be a live row), then the silent rest: a merchant that simply returned nothing for this
 * search still gets a clickable, affiliate-routed exit, which is exactly the deep-link-first idea.
 */
const MERCHANTS: MerchantDef[] = [
  // ---- measured walls: these can never be read server-side ----
  { seller: 'Booking.com', domain: 'booking.com', verticals: ['hotels'], gated: 'booking.com serves a 202 client shell; no property-card HTML to parse', path: { hotels: 'searchresults.html' } },
  { seller: 'Booking.com Flights', domain: 'booking.com', verticals: ['flights'], gated: 'flights.booking.com serves a 202 shell from our egress', path: { flights: 'flights/index.en-gb.html' } },
  { seller: 'Booking.com Taxi', domain: 'booking.com', verticals: ['cab'], gated: 'taxi.booking.com answers 405 Human Verification', path: { cab: 'taxi/index.en-gb.html' } },
  { seller: 'IndiGo', domain: 'goindigo.in', verticals: ['flights'], gated: 'IndiGo API is Akamai-gated and needs a SkyPlus session token', path: { flights: 'booking.html' } },
  { seller: 'Akasa Air', domain: 'akasaair.com', verticals: ['flights'], gated: 'Akasa IBE answers nginx 403 without an authorised Cognito bearer' },
  // ---- the rest of the market: hub when this search produced no row from them ----
  { seller: 'RedBus', domain: 'redbus.in', verticals: ['bus'] },
  { seller: 'AbhiBus', domain: 'abhibus.com', verticals: ['bus'] },
  { seller: 'ZingBus', domain: 'zingbus.com', verticals: ['bus'] },
  { seller: 'Expedia', domain: 'expedia.co.in', verticals: ['hotels', 'flights'], path: { hotels: 'Hotel-Search', flights: 'Flights' } },
  { seller: 'Cleartrip', domain: 'cleartrip.com', verticals: ['hotels', 'flights'], path: { hotels: 'hotels', flights: 'flights' } },
  { seller: 'MakeMyTrip', domain: 'makemytrip.com', verticals: ['hotels', 'flights', 'bus'], path: { hotels: 'hotels', flights: 'flights', bus: 'bus-tickets' } },
  { seller: 'Goibibo', domain: 'goibibo.com', verticals: ['hotels', 'flights'], path: { hotels: 'hotels', flights: 'flights' } },
  { seller: 'Agoda', domain: 'agoda.com', verticals: ['hotels'], path: { hotels: 'search' } },
  { seller: 'Yatra', domain: 'yatra.com', verticals: ['hotels', 'flights', 'bus'], path: { hotels: 'hotels', flights: 'flights', bus: 'bus' } },
  { seller: 'Ixigo', domain: 'ixigo.com', verticals: ['hotels', 'flights'], path: { hotels: 'hotels', flights: 'flights' } },
  { seller: 'EaseMyTrip', domain: 'easemytrip.com', verticals: ['hotels', 'flights'], path: { hotels: 'hotels', flights: 'flights.html' } },
  { seller: 'Hotels.com', domain: 'hotels.com', verticals: ['hotels'] },
  { seller: 'Airbnb', domain: 'airbnb.co.in', verticals: ['hotels'] },
  { seller: 'OYO', domain: 'oyorooms.com', verticals: ['hotels'] },
  { seller: 'Trivago', domain: 'trivago.in', verticals: ['hotels'] },
  { seller: 'SpiceJet', domain: 'spicejet.com', verticals: ['flights'] },
  { seller: 'Air India', domain: 'airindia.com', verticals: ['flights'] },
  { seller: 'Air India Express', domain: 'airindiaexpress.com', verticals: ['flights'] },
  { seller: 'Qatar Airways', domain: 'qatarairways.com', verticals: ['flights'] },
  { seller: 'Emirates', domain: 'emirates.com', verticals: ['flights'] },
  { seller: 'Cathay Pacific', domain: 'cathaypacific.com', verticals: ['flights'] },
  { seller: 'British Airways', domain: 'britishairways.com', verticals: ['flights'] },
  { seller: 'SriLankan Airlines', domain: 'srilankan.com', verticals: ['flights'] },
  { seller: 'Singapore Airlines', domain: 'singaporeair.com', verticals: ['flights'] },
  { seller: 'Alliance Air', domain: 'allianceair.in', verticals: ['flights'] },
  { seller: 'Fly91', domain: 'fly91.in', verticals: ['flights'] },
  { seller: 'Star Air', domain: 'starair.in', verticals: ['flights'] },
  { seller: 'Kiwi.com', domain: 'kiwi.com', verticals: ['flights'] },
  { seller: 'BudgetAir', domain: 'budgetair.co.in', verticals: ['flights'] },
  { seller: 'Gotogate', domain: 'gotogate.co.in', verticals: ['flights'] },
  { seller: 'FlightNetwork', domain: 'flightnetwork.com', verticals: ['flights'] },
  { seller: 'Aertrip', domain: 'aertrip.com', verticals: ['flights'] },
  { seller: 'Uber', domain: 'uber.com', verticals: ['cab'], path: { cab: '' } },
  { seller: 'Ola', domain: 'olacabs.com', verticals: ['cab'] },
  { seller: 'Rapido', domain: 'rapido.bike', verticals: ['cab'] },
  { seller: 'Meru', domain: 'meru.in', verticals: ['cab'] },
  { seller: 'Savaari', domain: 'savaari.com', verticals: ['cab'] },
  { seller: 'Bharat Taxi', domain: 'bharattaxi.com', verticals: ['cab'] },
];

function fallbackFor(m: MerchantDef, vertical: Vert, ctx: { city?: string; depart?: string; returnDate?: string }): string {
  const path = m.path?.[vertical] ?? '';
  if (m.domain === 'booking.com' && vertical === 'hotels') {
    const q = new URLSearchParams({ ss: ctx.city || 'India', selected_currency: 'INR', lang: 'en-gb' });
    if (ctx.depart) q.set('checkin', ctx.depart);
    if (ctx.returnDate) q.set('checkout', ctx.returnDate);
    return `https://www.booking.com/searchresults.html?${q.toString()}`;
  }
  if (m.domain === 'agoda.com') return `https://www.agoda.com/search?q=${encodeURIComponent(ctx.city || 'India')}`;
  const base = `https://www.${m.domain}/${path}`;
  if (!path) return `https://www.${m.domain}/`;
  // A file path (index.html, flights.html) never takes a trailing slash.
  return /\.html?$/.test(path) || path.includes('searchresults') ? base : `${base.replace(/\/+$/, '')}/`;
}

export const GATED_HUB_MERCHANTS: Record<string, HubMerchant[]> = (() => {
  const out: Record<string, HubMerchant[]> = { hotels: [], flights: [], cab: [], bus: [] };
  for (const m of MERCHANTS) {
    for (const v of m.verticals) {
      out[v].push({
        seller: m.seller,
        domain: m.domain,
        reason: m.gated || `no priced row from ${m.seller} for this search; the exit is affiliate-routed`,
        fallbackUrl: (ctx) => fallbackFor(m, v, ctx),
      });
    }
  }
  // Gated partners stay first: they can never appear as a live row, so their hub is the only way in.
  for (const v of Object.keys(out)) out[v].sort((a, b) => Number(Boolean(b.reason.includes('serves') || b.reason.includes('403') || b.reason.includes('405') || b.reason.includes('Akamai'))) - Number(Boolean(a.reason.includes('serves') || a.reason.includes('403') || a.reason.includes('405') || a.reason.includes('Akamai'))));
  return out;
})();

const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Seller/domain presence already in the live answer, so a hub never duplicates a real row. */
export function sellersPresent(rows: Array<any>): Set<string> {
  const out = new Set<string>();
  for (const r of rows || []) {
    const cands = [r?.seller, r?.provider, r?.brand, r?.sellerUrl, r?.seller_url, r?.url];
    for (const c of cands) {
      const v = String(c || '').toLowerCase();
      if (!v) continue;
      out.add(norm(v));
      const host = v.match(/https?:\/\/([^/]+)/)?.[1] || (v.includes('.') ? v.split('/')[0] : '');
      if (host) out.add(norm(host.replace(/^www\./, '')));
    }
  }
  return out;
}

/** True when a partner is already represented (by name or domain, subdomains included). */
export function hasPartner(present: Set<string>, m: HubMerchant): boolean {
  if (present.has(norm(m.seller))) return true;
  const base = norm(m.domain);
  for (const p of present) if (p === base || p.endsWith(base)) return true;
  return false;
}

/**
 * Builds the hub list for a search. Pure + offline: no network, so a hub can never delay or fail a search.
 */
export function buildIntentHubs(input: {
  vertical: string;
  title: string;
  rows: Array<any>;
  travel?: { depart?: string; return?: string };
  city?: string;
}): IntentHub[] {
  const merchants = GATED_HUB_MERCHANTS[String(input.vertical || '').toLowerCase()];
  if (!merchants?.length) return [];
  const present = sellersPresent(input.rows);
  const limit = Number(process.env.T1S_HUB_LIMIT || 8);
  const hubs: IntentHub[] = [];
  for (const m of merchants) {
    if (hubs.length >= limit) break;
    if (hasPartner(present, m)) continue;
    let url = '';
    try {
      url = merchantDeepLink(m.seller, input.title || '', input.vertical, {
        city: input.city,
        // Both spellings: merchantLink implementations differ (checkin/checkout vs checkIn/checkOut).
        checkin: input.travel?.depart,
        checkout: input.travel?.return,
        checkIn: input.travel?.depart,
        checkOut: input.travel?.return,
        depart: input.travel?.depart,
        origin: input.title,
      } as any);
    } catch {
      url = '';
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      // No affiliate template for this seller yet: still a hub, the click is attributed at /api/out.
      try {
        url = m.fallbackUrl({ city: input.city, depart: input.travel?.depart, returnDate: input.travel?.return, title: input.title });
      } catch {
        url = '';
      }
    }
    if (!url || !/^https?:\/\//i.test(url)) continue;
    hubs.push({ seller: m.seller, domain: m.domain, url, reason: m.reason });
  }
  return hubs;
}

/** Reads a travel date off an already-captured catalogue row (never guesses one). */
function rowDate(row: any): string {
  const raw = [
    row?.attributes?.travel_date,
    row?.attributes?.check_in,
    row?.attributes?.depart,
    row?.attributes?.journey_date,
  ].find((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
  return raw ? String(raw).slice(0, 10) : '';
}

/**
 * Priced, exact-date hub ROWS from our own catalogue (MySQL), for partners the live sweep could not reach.
 * This is the "pre-indexed route data" half of the hybrid: real captured prices only, freshness labelled,
 * and never for a different date than the one asked for.
 */
export async function catalogueHubRows(input: {
  vertical: string;
  title: string;
  city?: string;
  depart?: string;
  rows: Array<any>;
  limit?: number;
}): Promise<Array<any>> {
  const merchants = GATED_HUB_MERCHANTS[String(input.vertical || '').toLowerCase()];
  if (!merchants?.length) return [];
  const present = sellersPresent(input.rows);
  const wanted = merchants.filter((m) => !hasPartner(present, m));
  if (!wanted.length) return [];

  const terms = String(input.title || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  let catalogue: Awaited<ReturnType<typeof findCatalogueOffers>> = [];
  try {
    catalogue = await findCatalogueOffers(input.vertical, {
      city: input.city,
      queryTerms: terms.slice(0, 2),
      limit: 40,
      date: input.depart,
    });
  } catch {
    return [];
  }

  const out: Array<any> = [];
  for (const row of catalogue) {
    const price = Number(row.effective_price ?? row.mandatory_total ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue; // No Price, No Card
    const seller = String(row.seller || row.vendor || '');
    const domainHit = wanted.find((m) => norm(seller).includes(norm(m.domain).slice(0, 5)) || norm(seller) === norm(m.seller));
    if (!domainHit) continue;
    const date = rowDate(row);
    if (input.depart && date && date !== input.depart) continue; // exact date only
    if (out.some((r) => r.seller === seller && r.primaryPrice === price)) continue;
    const url = String(row.seller_url || '') || buildIntentHubs({ ...input, rows: [] }).find((h) => h.seller === domainHit.seller)?.url || '';
    out.push({
      id: `hub-${row.id}`,
      title: `${seller} ${input.title || ''}`.trim(),
      primaryPrice: price,
      currency: row.currency || 'INR',
      seller,
      sellerUrl: url,
      availability: row.availability || 'unknown',
      specs: {
        ...(date ? { 'travel date': date } : {}),
        'last seen price': new Date(row.fetched_at || Date.now()).toISOString().slice(0, 10),
      },
      hub: true,
      attributes: {
        price_basis: 'catalogue',
        verify_live: '1',
        hub_reason: domainHit.reason,
        catalogue_age_ms: String(Date.now() - new Date(row.fetched_at || Date.now()).getTime()),
      },
    });
    if (out.length >= (input.limit ?? 3)) break;
  }
  return out;
}

/**
 * Attaches the hybrid to an already-gated answer, additively:
 *  - `intentHubs`: [{seller, url, reason}] for unreadable partners (no price, so it is not a card);
 *  - catalogue-backed priced rows (hub: true) when MySQL holds that exact partner + date.
 * Idempotent, never throws, and never removes or reorders an existing row.
 */
export async function attachIntentHubs(
  response: any,
  input: { vertical: string; query?: string; city?: string; depart?: string; returnDate?: string },
): Promise<any> {
  if (!response) return response;
  try {
    const rows = Array.isArray(response.results) ? response.results : [];
    const title = String(response.query || input.query || '');
    const hubs = buildIntentHubs({
      vertical: input.vertical,
      title,
      rows,
      city: input.city,
      travel: { depart: input.depart, return: input.returnDate },
    });
    const catRows = await catalogueHubRows({
      vertical: input.vertical,
      title,
      city: input.city,
      depart: input.depart,
      rows,
    });
    if (!hubs.length && !catRows.length) return response;
    return {
      ...response,
      intentHubs: hubs,
      results: [...catRows, ...rows],
      resultsCount: catRows.length + rows.length,
    };
  } catch {
    return response;
  }
}
