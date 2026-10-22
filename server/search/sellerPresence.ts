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
import { yatraSrpUrl } from '../workers/parsers/yatraFlights';
import { AKASA_WEB } from '../workers/parsers/akasaFlights';

const PRESENCE_SELLERS: Array<{ seller: string; sourceId: string; srp: (rt: { from: string; to: string; fromCode: string; toCode: string; }, dIso: string) => string; note: string }> = [
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
export async function buildFlightSellerPresence(parsed: ParsedQuery, combined: NormalizedOffer[]): Promise<NormalizedOffer[]> {
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
  for (const cfg of PRESENCE_SELLERS) {
    if (presentSellers.has(cfg.seller.toLowerCase())) continue;
    out.push(presenceOffer(cfg.seller, cfg.sourceId, cfg.srp(rt, dIso), cfg.note, rt0.from, rt0.to, dIso));
  }
  return out;
}
