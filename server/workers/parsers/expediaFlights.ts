/**
 * Expedia flights parser (flights vertical).
 *
 * Expedia.com runs the "flights-shopping-pwa" storefront. Browserless recipe
 * (reverse-engineered + LIVE-VERIFIED 14 Oct 2026): GET the Flights-Search SRP
 * with curl_cffi safari impersonation (primes Akamai cookies + DUAID), then POST
 * https://www.expedia.com/graphql with operationName FlightsSearchResultsLoadedQuery
 * and the exact document the PWA ships (parsers/expediaFlightsQuery.ts).
 *
 * LIVE response shape (captured /tmp/fx_real_response.json, IDR→DEL 21 Oct 2026,
 * 19 listings, 1MB): data.flightsSearch.listingResult.listings[] are
 * FlightsStandardOffer objects (NO __typename — a leading UI header entry is
 * skipped by shape, not by typename):
 *   priceDisplay.rows[].elements[] — on FlightsPriceMessageItem { price { text: "$89" } }
 *     (USD on the .com storefront → converted honestly via live FX)
 *   flightsShoppingOfferContent.graphic — Mark { url { value } } (airline logo)
 *   flightsShoppingOfferContent.secondarySection[] —
 *     [ FlightShoppingCardDurationTimeline { start { primary "2:15pm" },
 *       end { primary "3:55pm" }, stops }, EGDSTextSection.contents[] ("Air India") ]
 *   flightsShoppingOfferContent.tertiarySection[] — "1h 40m • Nonstop"
 *   journeys[0].detailsAndFares.content.sections[] — on
 *     FlightsJourneyDetailsInformation.content[0] (FlightsJourneyDetails)
 *     .journeySections[].journeyConnectionInformation[] — on
 *     FlightsConnectionInformation.flightsConnection { airlineInfo "Air India 2516",
 *       airlineDetails.text[].items ("AI2516"), aircraftModel, duration
 *       "Travel time: 1h 40m", connectionDeparture { subtitle "…(IDR)",
 *       journeyDateTime[0].text "2:15pm" }, connectionArrival { …(DEL) } }
 *
 * Expedia is an OTA that OWNS the price (the booking completes on expedia.com), so
 * per the deeplink policy the seller is Expedia and sellerUrl goes to expedia.com.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import type { FxRate } from './expediaGroup';

/** Extract the first price number ("$89" → 89) from priceDisplay rows. */
function listingPrice(L: any): number {
  for (const row of L?.priceDisplay?.rows || []) {
    for (const el of row?.elements || []) {
      if (el?.__typename === 'FlightsPriceMessageItem') {
        const m = String(el?.price?.text || '').replace(/\s/g, '').match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
        if (m) {
          const n = Number(m[2].replace(/,/g, ''));
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
    }
  }
  return 0;
}

/** The duration timeline element (dep/arr times + stops) from the secondarySection list. */
function listingTimeline(L: any): any | null {
  for (const s of L?.flightsShoppingOfferContent?.secondarySection || []) {
    if (s?.__typename === 'FlightShoppingCardDurationTimeline' || (s?.start && s?.end)) return s;
  }
  return null;
}

/** Airline display name from the secondarySection text ("Air India"). */
function listingAirlineName(L: any): string {
  for (const s of L?.flightsShoppingOfferContent?.secondarySection || []) {
    if (s?.__typename !== 'EGDSTextSection') continue;
    for (const c of s?.contents || []) {
      const t = String(c?.text || '').trim();
      if (t && /\b(air|airlines?|indigo|vistara|airasia|akasa)\b/i.test(t) && !/→|-/.test(t)) return t;
    }
  }
  return '';
}

/** Airline logo URL from the content graphic (Mark). */
function listingLogo(L: any): string {
  const g = L?.flightsShoppingOfferContent?.graphic;
  const url = g?.url?.value || g?.url?.relativePath || '';
  return String(url || '').replace(/^http:/, 'https:');
}

/**
 * Per-leg flight data from the detailsAndFares dialog tree. Returns one entry
 * per journey leg: { flightNo, dep, depAirport, arr, arrAirport, aircraft }.
 */
function listingLegs(L: any): Array<{ flightNo: string; dep: string; depAirport: string; arr: string; arrAirport: string; aircraft: string }> {
  const legs: any[] = [];
  const sections = ((L?.journeys || [])[0]?.detailsAndFares?.content?.sections) || [];
  for (const sec of sections) {
    if (sec?.__typename !== 'FlightsJourneyDetailsInformation' && !sec?.content) continue;
    for (const jd of sec?.content || []) {
      if (!jd?.journeySections) continue;
      for (const js of jd.journeySections) {
        for (const jci of js?.journeyConnectionInformation || []) {
          const fc = jci?.flightsConnection;
          if (!fc) continue;
          // Flight number: airlineDetails phrase items ("AI2516") beat airlineInfo ("Air India 2516").
          let flightNo = '';
          for (const ph of fc?.airlineDetails?.text || []) {
            for (const it of ph?.items || []) {
              if (it?.__typename === 'FlightsPhraseTextNode' && /^\s*[A-Z0-9]{2}\d{2,4}\s*$/.test(String(it?.text || ''))) {
                flightNo = String(it.text).trim(); break;
              }
            }
            if (flightNo) break;
          }
          if (!flightNo) {
            const m = String(fc?.airlineInfo || '').match(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/);
            if (m) flightNo = `${m[1]}${m[2]}`;
          }
          const dt = (side: any) => String((side?.journeyDateTime || [])[0]?.text || '').trim();
          legs.push({
            flightNo,
            dep: dt(fc?.connectionDeparture),
            depAirport: String(fc?.connectionDeparture?.subtitle || '').trim(),
            arr: dt(fc?.connectionArrival),
            arrAirport: String(fc?.connectionArrival?.subtitle || '').trim(),
            aircraft: String(fc?.aircraftModel || '').trim(),
          });
        }
      }
    }
  }
  return legs;
}

/** Total travel time text ("1h 40m") — timeline primaryMessage or per-leg duration sums. */
function listingDuration(L: any): string {
  const tl = listingTimeline(L);
  const pm = String(tl?.primaryMessage?.text || '').trim();
  if (pm) return pm;
  const sections = ((L?.journeys || [])[0]?.detailsAndFares?.content?.sections) || [];
  for (const sec of sections) {
    for (const jd of sec?.content || []) {
      for (const js of jd?.journeySections || []) {
        for (const jci of js?.journeyConnectionInformation || []) {
          const d = String(jci?.flightsConnection?.duration || '').replace(/^Travel time:\s*/i, '').trim();
          if (d) return d;
        }
      }
    }
  }
  return '';
}

function parseStops(v: any): string {
  if (v == null) return '';
  const n = Number(v);
  if (Number.isFinite(n)) return n === 0 ? 'non-stop' : `${n} stop${n > 1 ? 's' : ''}`;
  return String(v);
}

export function parseExpediaFlights(
  body: string,
  source: SourceConfig,
  route: { from: string; to: string; fromCode: string; toCode: string },
  dateIso: string,
  srpUrl: string,
  fx?: FxRate | null,
  cap = 40,
): RawSourceItem[] {
  let d: any;
  try { d = JSON.parse(body); } catch { return []; }
  const listings = (((d?.data?.flightsSearch)?.listingResult)?.listings) || [];
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${route.from} → ${route.to}`;
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const L of listings) {
    // Real offers carry priceDisplay + flightsShoppingOfferContent; the leading
    // section-header entry (heading "Departing flights") does not.
    if (!L || !L.priceDisplay || !L.flightsShoppingOfferContent) continue;
    const usd = listingPrice(L);
    if (!usd) continue; // never publish a price we did not see
    const tl = listingTimeline(L);
    const legs = listingLegs(L);
    const dep = legs[0]?.dep || String(tl?.start?.primary || '').trim();
    const arr = (legs[legs.length - 1] || {}).arr || String(tl?.end?.primary || '').trim();
    if (!dep || !arr) continue; // no itinerary identity without times
    const airline = listingAirlineName(L) || (legs[0]?.flightNo || '').slice(0, 2);
    if (!airline) continue;
    const flightNos = legs.map((l) => l.flightNo).filter(Boolean);
    const flightNo = flightNos.join('/');
    const stops = parseStops(tl?.stops);
    const duration = listingDuration(L);
    const depAirport = legs[0]?.depAirport || '';
    const arrAirport = legs[legs.length - 1]?.arrAirport || '';
    const aircraft = legs.map((l) => l.aircraft).filter(Boolean)[0] || '';
    const key = `${airline}|${flightNo}|${dep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (out.length >= cap) break;
    const { price, currency, dataNote } = fx && fx.rate > 0
      ? { price: Math.round(usd * fx.rate), currency: 'INR',
          dataNote: `$${usd} listed on expedia.com, converted to INR at live USD/INR ${fx.rate} (${fx.source}); live fare observed on Expedia flight search on ${today}. Fare may change at checkout.` }
      : { price: usd, currency: 'USD',
          dataNote: `Live fare observed on Expedia flight search on ${today}; listed in USD on expedia.com (FX rate unavailable, price unconverted). Fare may change at checkout.` };
    const logo = listingLogo(L);
    out.push(newRawItem(source, {
      title: `${airline}${flightNo ? ` ${flightNo}` : ''} · ${routeLabel}`,
      brand: airline,
      price, currency,
      seller: 'Expedia',
      sellerUrl: srpUrl,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        departure: dep,
        arrival: arr,
        ...(depAirport && arrAirport ? { airports: `${depAirport} → ${arrAirport}` } : {}),
        ...(duration ? { duration } : {}),
        ...(stops ? { stops } : {}),
        ...(aircraft ? { aircraft } : {}),
        ...(logo ? { image_url: logo } : {}),
        price_basis: 'live fare observed on expedia.com flight search',
        data_note: dataNote,
        deep_link_ref: srpUrl,
      },
      identifiers: { sku: `expedia-${flightNo || dep}-${dateIso}`.replace(/\s+/g, '-').toLowerCase() },
      evidence: {
        sourceUrl: srpUrl,
        extractedFields: ['listingResult.listings[].priceDisplay', 'journeyConnectionInformation.flightsConnection', 'FlightShoppingCardDurationTimeline'],
      },
    }));
  }
  return out;
}

/** Honest helper: does the JSON carry a listingResult at all? */
export function expediaFlightsHasListings(body: string): boolean {
  try {
    const d = JSON.parse(body);
    const lr = d?.data?.flightsSearch?.listingResult;
    return Array.isArray(lr?.listings) && lr.listings.length > 0;
  } catch { return false; }
}
