/**
 * SELLER PRESENCE ROWS (owner 22 Oct): "yatra, indigo, akasa aur expedia ko
 * app level pr lao, atleast kaise v affiliate deeplink add kr ke".
 *
 * These four mandatory flight sellers are IP-gated / circuit-backed-off from
 * our network right now, so their live rows never reach the app. Their
 * circuits and gate-lift probes stay fully intact (self-healing rule) — this
 * module only adds an HONEST presence row when a seller contributed nothing:
 * the seller's own route-prefilled search/booking URL, monetized at click time
 * by /api/out (LinkInR Yatra campaign; Ekaro/Cuelinks/admin configs otherwise).
 *
 * Honesty rules (no fabrication):
 *   - NO price is claimed — the card renders without one, like the Rapido
 *     "Fare on app" precedent (price_basis: app_only_fares, 17 Oct).
 *   - The data_note says exactly why: live fares are not reachable from our
 *     servers right now; open the seller to see their live fare.
 *   - When the seller's live acquisition works again, its real priced rows
 *     are present and the presence row is skipped automatically.
 */
import type { NormalizedOffer, ParsedQuery } from '../types';
import { resolveAirport } from '../common/airportLookup';
import { routeFromQuery } from '../workers/verticals/flights';
import { getHealth } from '../sources/health';
import { yatraSrpUrl } from '../workers/parsers/yatraFlights';
import { AKASA_WEB } from '../workers/parsers/akasaFlights';
import { agodaFlightsSrpUrl } from '../workers/parsers/agodaFlights';
import { GOTOGATE_IN, FLIGHTNETWORK_IN, EtraveliBrandConfig } from '../workers/parsers/etraveliFlights';

export const PRESENCE_SHOW_ON_EMPTY_IDS: ReadonlySet<string> = new Set(
  ['w_flights_budgetair', 'w_flights_gotogate', 'w_flights_flightnetwork', 'w_flights_flightsmojo', 'w_flights_bookingcom', 'w_flights_agodaflights'],
);

// showOnEmpty (owner 24 Oct OTA expansion): route-agnostic OTA aggregators —
// an EMPTY_RESPONSE from a not-yet-cracked recipe means the recipe is missing,
// NOT that the OTA has no service on the route (unlike carriers like Akasa on
// IDR-DEL). These sellers keep their honest presence card until their live
// fare recipe ships, then priced rows suppress it automatically.

/** Etraveli results deeplink: /air/{FROM}{TO}{DDMMM}/1/-/-/c:Y (the SPA's own
 *  shareable results path — 302s to /rf/result which hydrates the search). */
export function etraveliResultsUrl(brand: EtraveliBrandConfig, rt: { fromCode: string; toCode: string }, dIso: string): string {
  const m = [/^\d{4}-(\d{2})-(\d{2})$/.exec(dIso || '')];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = m[0] ? m[0][2] : '28';
  const mon = m[0] ? MONTHS[parseInt(m[0][1], 10) - 1] || 'OCT' : 'OCT';
  return `https://${brand.host}/air/${rt.fromCode}${rt.toCode}${day}${mon}/1/-/-/c:Y`;
}

const PRESENCE_SELLERS: Array<{ seller: string; sourceId: string; srp: (rt: { from: string; to: string; fromCode: string; toCode: string; }, dIso: string) => string; note: string; showOnEmpty?: boolean }> = [
  {
    seller: 'Yatra',
    sourceId: 'w_flights_yatra',
    srp: (rt, dIso) => yatraSrpUrl(rt.fromCode, rt.toCode, dIso),
    note: "Yatra's live fare feed is not reachable from our servers right now; this opens Yatra's own results for the route with the date prefilled.",
  },
  {
    seller: 'IndiGo',
    sourceId: 'w_flights_indigo',
    srp: (rt, dIso) => `https://www.goindigo.in/flight-booking/booking?journeyType=One%20Way&from=${rt.fromCode}&to=${rt.toCode}&depart=${dIso}&pax=A1`,
    note: "IndiGo's live fare feed is not reachable from our servers right now; this opens IndiGo's own booking widget with the route and date prefilled.",
  },
  {
    seller: 'Akasa Air',
    sourceId: 'w_flights_akasa',
    srp: () => `${AKASA_WEB}/booking`,
    note: "Akasa Air's live fare feed is not reachable from our servers right now; this opens Akasa Air's own booking flow to check availability for the route.",
  },
  {
    seller: 'Expedia',
    sourceId: 'w_flights_expedia',
    srp: (rt, dIso) => `https://www.expedia.com/Flights-Search?flight-type=oneway&from-date=${dIso}`
      + `&from=${encodeURIComponent(`${rt.from} (${rt.fromCode})`)}&to=${encodeURIComponent(`${rt.to} (${rt.toCode})`)}&search-type=arsed&mode=search`,
    note: "Expedia's live fare feed is not reachable from our servers right now; this opens Expedia's own results for the route with the date prefilled.",
  },
  // ---- Owner 24 Oct OTA expansion (presence until live recipes ship) ----
  {
    seller: 'BudgetAir',
    sourceId: 'w_flights_budgetair',
    srp: (rt, dIso) => `https://www.budgetair.com/en_us/flights/${rt.fromCode}/${rt.toCode}/${dIso}`,
    note: "BudgetAir's Travix fare gateway is live; if its priced row is unavailable for this search, this opens BudgetAir's own results page with the route and date prefilled.",
    showOnEmpty: true,
  },
  {
    seller: 'Gotogate',
    sourceId: 'w_flights_gotogate',
    srp: (rt, dIso) => etraveliResultsUrl(GOTOGATE_IN, rt, dIso),
    note: "Gotogate's live fare feed is served from its India storefront; if its priced row is unavailable for this search, this opens Gotogate's own results page with the route and date prefilled.",
    showOnEmpty: true,
  },
  {
    seller: 'FlightNetwork',
    sourceId: 'w_flights_flightnetwork',
    srp: (rt, dIso) => etraveliResultsUrl(FLIGHTNETWORK_IN, rt, dIso),
    note: "FlightNetwork's live fare feed is served from its India storefront; if its priced row is unavailable for this search, this opens FlightNetwork's own results page with the route and date prefilled.",
    showOnEmpty: true,
  },
  {
    seller: 'FlightsMojo',
    sourceId: 'w_flights_flightsmojo',
    srp: (rt) => `https://www.flightsmojo.com/flights/${rt.from.toLowerCase().replace(/\s+/g, '-')}-to-${rt.to.toLowerCase().replace(/\s+/g, '-')}-flights`,
    note: "FlightsMojo's live fare API is wired; if its priced row is unavailable for this search, this opens FlightsMojo's own results page for the route.",
    showOnEmpty: true,
  },
  {
    seller: 'Booking.com',
    sourceId: 'w_flights_bookingcom',
    srp: () => 'https://flights.booking.com/',
    note: "Booking.com flights answers a bot challenge to datacenter IPs; this opens Booking.com's own flight search to check fares for the route.",
    showOnEmpty: true,
  },
  {
    seller: 'Agoda',
    sourceId: 'w_flights_agodaflights',
    srp: (rt, dIso) => agodaFlightsSrpUrl(rt.fromCode, rt.toCode, dIso),
    note: "Agoda's live fare API is wired; if its priced row is unavailable for this search, this opens Agoda's own results page with the route and date prefilled.",
    showOnEmpty: true,
  },

];

function presenceOffer(seller: string, sourceId: string, srp: string, note: string, from: string, to: string, dIso: string): NormalizedOffer {
  const now = new Date().toISOString();
  return {
    id: `presence_${sourceId}_${from}_${to}_${dIso}`.toLowerCase().replace(/\s+/g, '-'),
    canonicalEntityId: null,
    canonicalVariantId: null,
    vertical: 'flights',
    title: `${seller} flights: ${from} → ${to}`,
    brand: seller,
    identifiers: { sku: `presence-${seller}-${from}-${to}-${dIso}`.toLowerCase().replace(/\s+/g, '-') },
    attributes: {
      route: `${from} → ${to}`,
      travel_date: dIso,
      price_basis: 'live_fares_unavailable',
      data_note: `${note} No price is shown because we never invent one.`,
    },
    vendor: seller,
    seller,
    sellerUrl: srp,
    travel: { route: `${from.toLowerCase()} to ${to.toLowerCase()}`, date: dIso },
    prices: { currency: 'INR', fees: {} },
    availability: 'unknown',
    matchState: 'PROBABLE_MATCH',
    freshnessStatus: 'FRESH',
    validationStatus: 'VALID',
    confidence: 0.75,
    provenance: {
      sourceId,
      sourceMethod: 'direct_http',
      adapterVersion: 'presence-v1',
      parserVersion: 'seller-presence/1.0',
      sourceUrl: srp,
      sourceReference: 'Seller presence row (route-prefilled seller search page; no fare claimed)',
      fetchedAt: now,
      validatedAt: now,
    },
  };
}

/** Presence rows for every mandatory flight seller that contributed nothing to
 *  this response. Ephemeral: injected after acquisition, never persisted to the
 *  catalogue, regenerated honestly per search. */
export async function buildFlightSellerPresence(
  parsed: ParsedQuery,
  combined: NormalizedOffer[],
  succeededSourceIds?: string[],
): Promise<NormalizedOffer[]> {
  const raw = String(parsed.rawQuery || parsed.entityName || '');
  const rt0 = routeFromQuery(raw);
  if (!rt0) return [];
  const dIso = parsed.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(parsed.travelDates.depart)
    ? parsed.travelDates.depart
    : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const fromA = await resolveAirport(rt0.from, rt0.fromCode);
  const toA = await resolveAirport(rt0.to, rt0.toCode);
  if (!fromA.code || !toA.code) return []; // unknown city — honest skip
  const rt = { from: rt0.from, to: rt0.to, fromCode: fromA.code, toCode: toA.code };

  // Skip only when the seller has a MEANINGFUL (priced) row in this response:
  // an unpriced schedule-reference row (OpenFlights) would otherwise suppress the
  // presence card and then itself be dropped by the price filter — leaving the
  // seller with no card at all. Live priced rows still suppress the fallback.
  const presentSellers = new Set(
    combined
      .filter((o) => (Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) || 0) > 0)
      .map((o) => `${o.seller || ''}`.toLowerCase().trim())
      .filter(Boolean),
  );
  const out: NormalizedOffer[] = [];
  // HONEST NO-SERVICE (owner 24 Oct): when a seller's own live source SUCCEEDED
  // this search (its API answered us) yet returned no priced row, that is a
  // truthful zero — e.g. Akasa's API answers INVALID_STATION for a route it
  // does not fly. Showing a "feed unreachable / Price unavailable" card for a
  // carrier that simply has no service here is misleading, so the presence
  // row is skipped. Presence rows remain ONLY for genuinely gated/broken
  // sources (seller's source failed this search), which is what the owner's
  // brand-visibility rule (22 Oct) was written for.
  const succeeded = new Set((succeededSourceIds || []).map((x) => String(x)));
  for (const cfg of PRESENCE_SELLERS) {
    if (presentSellers.has(cfg.seller.toLowerCase())) continue;
    if (succeeded.has(cfg.sourceId)) continue; // honest empty from the seller's own API
    // CATALOGUE PARTIAL (24 Oct owner report): the instant cache-paint has no
    // acquisition outcome, so the check above never fires and "Price unavailable"
    // cards appeared for carriers that simply do not fly the route (Akasa on
    // IDR-DEL). The seller's own source health carries its LATEST honest
    // outcome: EMPTY_RESPONSE means the API answered us with a truthful zero
    // (no service / sold out) — no "feed unreachable" card for that seller. A
    // gated source's latest class becomes ACCESS_CHALLENGE/RATE_LIMITED and
    // the presence card returns automatically (self-healing).
    const h = getHealth(cfg.sourceId);
    if (h.lastFailureClass === 'EMPTY_RESPONSE' && !cfg.showOnEmpty) continue;
    out.push(presenceOffer(cfg.seller, cfg.sourceId, cfg.srp(rt, dIso), cfg.note, rt0.from, rt0.to, dIso));
  }
  return out;
}
