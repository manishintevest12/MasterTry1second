/**
 * Kiwi.com flights parser — the umbrella/v2 GraphQL search API.
 *
 * CRACK (15 Oct 2026, fully browserless, no auth, ~800ms): Kiwi's internal
 * searchey GraphQL at api.skypicker.com/umbrella/v2/graphql is open to
 * unauthenticated POSTs. Schema was mapped via GraphQL introspection (enabled!):
 *   - RootQuery.onewayItineraries(search: SearchOnewayInput, options: ItinerariesOptionsInput)
 *   - options.partner: String! = 'skypicker' ('picky' -> "Partner not valid");
 *     options.currency = 'INR' returns rupee prices directly.
 *   - places are referenced by ID: 'Station:airport:<IATA>' (confirmed via
 *     places(search:{term}) — ids like 'Station:airport:DEL'), so our global
 *     IATA resolver feeds it with no place-resolution call.
 *   - DateTime scalar format: 'YYYY-MM-DDTHH:MM:SS' — NO 'Z', no millis, no
 *     offset (adding 'Z' 400s with "DateTime cannot represent value").
 *   - response: itineraries[] of ItineraryOneWay — sector.carriers (airline
 *     names+IATA), sector.sectorSegments[].segment (code = bare flight
 *     number, carrier, source/destination utcTimeIso + station IATA),
 *     price.amount INR (string), bookingOptions.edges[0].node.bookingUrl
 *     (relative per-itinerary booking token on www.kiwi.com).
 * Verified live: DEL→DXB 22 Oct 32 itineraries (cheapest 6E ₹19124), LHR→JFK
 * 49 itineraries (cheapest Avianca ₹66690) — Kiwi is a GLOBAL flight seller.
 */
import { cffiFetch } from '../../common/curlCffiFetch';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const GRAPHQL_URL = 'https://api.skypicker.com/umbrella/v2/graphql';

const SEARCH_QUERY = `query($search: SearchOnewayInput!, $options: ItinerariesOptionsInput) {
  onewayItineraries(search: $search, options: $options) {
    __typename
    ... on Itineraries {
      itineraries {
        ... on ItineraryOneWay {
          id
          sector {
            carriers { name code }
            duration
            sectorSegments {
              segment {
                code
                carrier { name code }
                source { utcTimeIso station { code } }
                destination { utcTimeIso station { code } }
              }
            }
          }
          price { amount currency { code } }
          bookingOptions { edges { node { bookingUrl } } }
        }
      }
      metadata { itinerariesCount }
    }
    ... on AppError { code message }
  }
}`;

export interface KiwiSegment {
  code: string | null;
  carrier: { name: string; code: string } | null;
  source?: { utcTimeIso?: string; station?: { code?: string } };
  destination?: { utcTimeIso?: string; station?: { code?: string } };
}

export interface KiwiItinerary {
  id: string;
  sector?: {
    carriers?: { name: string; code: string }[];
    sectorSegments?: { segment: KiwiSegment }[];
  };
  price?: { amount?: string; currency?: { code?: string } };
  bookingOptions?: { edges?: { node?: { bookingUrl?: string } }[] };
}

/** One POST = every itinerary on the route/date, cheapest-first. Returns null on 403/429. */
export async function kiwiSearch(
  fromIata: string,
  toIata: string,
  dateIso: string,
): Promise<{ itineraries: KiwiItinerary[]; total: number } | null> {
  const res = await cffiFetch(GRAPHQL_URL, {
    impersonate: 'chrome',
    timeoutMs: 40_000,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://www.kiwi.com', Referer: 'https://www.kiwi.com/' },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        search: {
          itinerary: {
            source: { ids: [`Station:airport:${fromIata}`] },
            destination: { ids: [`Station:airport:${toIata}`] },
            outboundDepartureDate: { start: `${dateIso}T00:00:00`, end: `${dateIso}T23:59:59` },
          },
          passengers: { adults: 1 },
        },
        options: { partner: 'skypicker', currency: 'INR', locale: 'en' },
      },
    }),
  });
  if (res.status === 403 || res.status === 429) return null; // caller reports ACCESS_CHALLENGE
  if (res.status !== 200) throw new Error(`Kiwi graphql HTTP ${res.status}`);
  const data = JSON.parse(res.body || '{}');
  const root = data?.data?.onewayItineraries;
  if (!root || root.__typename === 'AppError') throw new Error(`Kiwi AppError ${root?.code || ''} ${root?.message || 'no data'}`);
  const itineraries = (root.itineraries || []) as KiwiItinerary[];
  return { itineraries, total: root.metadata?.itinerariesCount ?? itineraries.length };
}

/** Map to catalogue items. Seller = Kiwi.com (the ticket-selling website). */
export function kiwiItems(
  itineraries: KiwiItinerary[],
  source: SourceConfig,
  route: { from: string; to: string },
  fromCode: string,
  toCode: string,
  dateIso: string,
  cap = 60,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const it of itineraries) {
    if (out.length >= cap) break;
    const segs = (it.sector?.sectorSegments || []).map((s) => s.segment).filter(Boolean);
    if (segs.length === 0) continue;
    // keep only itineraries departing on the requested day (Kiwi can spill ±1 day)
    const depDay = (segs[0].source?.utcTimeIso || '').slice(0, 10);
    if (depDay !== dateIso) continue;
    const al0 = segs[0].carrier;
    if (!al0?.code) continue;
    const flightNos = segs.map((s) => `${s.carrier?.code || ''}${s.code || ''}`);
    const flightNoKey = flightNos.join('-');
    const depTime = (segs[0].source?.utcTimeIso || '').slice(11, 16);
    const arrTime = (segs[segs.length - 1]?.destination?.utcTimeIso || '').slice(11, 16);
    const stops = segs.length - 1;
    const key = `${al0.code}|${flightNoKey}|${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fare = Number(it.price?.amount || 0);
    if (!fare || fare <= 0) continue; // never publish a price we did not see
    const rawUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl || '';
    const bookingUrl = rawUrl.startsWith('http') ? rawUrl : rawUrl ? `https://www.kiwi.com${rawUrl}` : '';
    const routeLabel = `${route.from} → ${route.to}`;
    const alNames = [...new Set((it.sector?.carriers || []).map((c) => c.name))].join(' + ');
    out.push(newRawItem(source, {
      title: `${alNames || al0.name} ${flightNoKey} · ${routeLabel}`.slice(0, 200),
      brand: (alNames || al0.name).slice(0, 80),
      price: Math.round(fare),
      currency: it.price?.currency?.code || 'INR',
      seller: 'Kiwi.com',
      sellerUrl: bookingUrl || `https://www.kiwi.com/en/search/results/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${dateIso}`,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso, seatType: 'economy' },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline: alNames || al0.name,
        airline_code: al0.code,
        flight_number: flightNoKey,
        departure: depTime,
        arrival: arrTime,
        stops: String(stops),
        price_basis: `live ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on Kiwi.com's flight search on ${today} (Kiwi.com is the selling website)`,
        data_note: `Fare acquired via Kiwi.com's search API on ${today}; the ticket is SOLD by Kiwi.com (seller), operating carrier ${alNames || al0.name}. Price may change at checkout.`,
      },
      identifiers: { sku: `kiwi-${flightNoKey}-${dateIso}-${depTime}`.slice(0, 120) },
      evidence: {
        sourceUrl: GRAPHQL_URL,
        sourceReference: it.id.slice(0, 160),
        extractedFields: ['itineraries[].price.amount (INR)', 'sector.carriers', 'segment.code/utcTimeIso', 'bookingOptions.edges[].node.bookingUrl'],
      },
    }));
  }
  return out;
}
