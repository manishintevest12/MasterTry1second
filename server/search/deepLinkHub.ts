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

/**
 * Partners measured as unreadable from our egress (see the rescue-ladder probe logs) but monetisable the
 * moment a user lands on their site. Extend per vertical; order is display order.
 */
export const GATED_HUB_MERCHANTS: Record<string, HubMerchant[]> = {
  hotels: [
    {
      seller: 'Booking.com',
      domain: 'booking.com',
      reason: 'booking.com serves a 202 client shell; no property-card HTML to parse',
      fallbackUrl: ({ city, depart, returnDate }) => {
        const q = new URLSearchParams({ ss: city || 'India', selected_currency: 'INR', lang: 'en-gb' });
        if (depart) q.set('checkin', depart);
        if (returnDate) q.set('checkout', returnDate);
        return `https://www.booking.com/searchresults.html?${q.toString()}`;
      },
    },
    {
      seller: 'Agoda',
      domain: 'agoda.com',
      reason: 'agoda answers only for some city/date combinations',
      fallbackUrl: ({ city }) => `https://www.agoda.com/search?city=${encodeURIComponent(city || 'India')}`,
    },
  ],
  flights: [
    {
      seller: 'Booking.com Flights',
      domain: 'booking.com',
      reason: 'flights.booking.com serves a 202 shell from our egress',
      fallbackUrl: () => 'https://www.booking.com/flights/index.en-gb.html',
    },
    {
      seller: 'IndiGo',
      domain: 'goindigo.in',
      reason: 'IndiGo API is Akamai-gated and needs a SkyPlus session token',
      fallbackUrl: () => 'https://www.goindigo.in/',
    },
    {
      seller: 'Akasa Air',
      domain: 'akasaair.com',
      reason: 'Akasa IBE answers nginx 403 without an authorised Cognito bearer',
      fallbackUrl: () => 'https://www.akasaair.com/',
    },
  ],
  cab: [
    {
      seller: 'Booking.com Taxi',
      domain: 'booking.com',
      reason: 'taxi.booking.com answers 405 Human Verification',
      fallbackUrl: () => 'https://www.booking.com/taxi/index.en-gb.html',
    },
  ],
};

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
  const hubs: IntentHub[] = [];
  for (const m of merchants) {
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
