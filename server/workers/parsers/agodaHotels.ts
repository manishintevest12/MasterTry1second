/**
 * Agoda hotels parser — hotels vertical (live per-night rates).
 *
 * Agoda's SRP HTML is an SSR shell, but the real prices ship through its own
 * token-gated GraphQL endpoint — fully usable browserless (curl_cffi chrome,
 * no auth, no browser). Verified live 13 Oct 2026 (30 properties, real INR
 * per-night rates for Goa + Bali). Three-step handshake:
 *
 *  1. CITY ID: GET https://www.agoda.com/city/{slug}-in.html → the page links
 *     to /search?city=<CityId> (stable Agoda city ids: Goa 11304, Delhi 17993,
 *     Mumbai 4923, Bangalore 4923-ish set verified). Tried for every
 *     cityVariants() spelling (agoda wants legacy spellings: delhi-in,
 *     bangalore-in, pondicherry-in — not new-delhi-in / bengaluru-in).
 *  2. PAGE CONFIG: GET /search?city=<id>&checkIn=..&los=<n> → HTML embeds
 *     `agoda.pageConfig = {…}` with correlationId + analyticsSessionId, which
 *     the GraphQL gate requires as AG-CORRELATION-ID / AG-ANALYTICS-SESSION-ID.
 *  3. GATE + QUERY: POST https://www.agoda.com/graphql/search
 *       query citySearch($CitySearchRequest: CitySearchRequest!,
 *                        $ContentSummaryRequest: ContentSummaryRequest!,
 *                        $PricingSummaryRequest: PricingRequestParameters)
 *     with headers AG-* plus x-gate-meta = base64("<ms epoch>||/graphql/search").
 *     The variables document is big but fully reconstructed from webpack
 *     module 379728 (search bundle): required enums travellerType:"AllGuests",
 *     requiredBasis:"PRPN", requiredPrice/suggestedPrice:"Exclusive";
 *     pricing context carries abTests + clientInfo + sessionInfo; pricing
 *     features must be a non-null object. Response: data.citySearch.properties[]
 *     with content (name/images/reviews/geo) and pricing.offers[0].roomOffers[0]
 *     .room.pricing { currency, price.perNight.{exclusive,inclusive}.display }.
 *
 * No browser automation, no CAPTCHA solving — plain HTTPS with browser TLS
 * impersonation. Agoda's displayed price is the tax-EXCLUSIVE per-night rate;
 * the inclusive figure is preserved in price_basis. Per owner policy this
 * source is price-only comparison (another site owns hotel metadata).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { cityVariants, slugOf } from '../../common/cityAlias';

export const AGODA_WEB = 'https://www.agoda.com';

export interface AgodaPageConfig {
  correlationId: string;
  analyticsSessionId: string;
}

export interface AgodaHotel {
  propertyId: string;
  name: string;
  accommodationType: string | null;
  cityName: string | null;
  score: number | null;
  reviews: number | null;
  pricePerNight: number | null;
  priceInclusive: number | null;
  currency: string;
  imageUrl: string | null;
  lat: number | null;
  lon: number | null;
  available: boolean;
}

/** Slug candidates for the /city/{slug}.html resolver, best first. */
export function agodaCitySlugs(city: string): string[] {
  const out: string[] = [];
  for (const v of cityVariants(city)) {
    const slug = `${slugOf(v)}-in`;
    if (!out.includes(slug)) out.push(slug);
  }
  return out.slice(0, 6);
}

/** CityId from the SEO city page HTML (link to /search?city=<id>). */
export function extractAgodaCityId(html: string): number | null {
  const m = html.match(/search\?city=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** correlationId/analyticsSessionId from agoda.pageConfig on the SRP shell. */
export function extractAgodaPageConfig(html: string): AgodaPageConfig | null {
  const m = html.match(/agoda\.pageConfig\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!m) return null;
  try {
    // The literal is a JS object with unquoted keys + Date values in places —
    // recover the two fields we need with targeted regexes instead of JSON.parse.
    const seg = m[1].slice(0, 4000);
    const cor = seg.match(/correlationId\s*:\s*["']([^"']+)["']/);
    const ana = seg.match(/analyticsSessionId\s*:\s*["']([^"']+)["']/);
    if (cor && ana) return { correlationId: cor[1], analyticsSessionId: ana[1] };
  } catch { /* fallthrough */ }
  const cor = html.match(/"correlationId"\s*:\s*"([^"]+)"/);
  const ana = html.match(/"analyticsSessionId"\s*:\s*"([^"]+)"/);
  if (cor && ana) return { correlationId: cor[1], analyticsSessionId: ana[1] };
  return null;
}

/** Gate headers for /graphql/search. epochMs ties the request to "now". */
export function agodaGateHeaders(cfg: AgodaPageConfig, epochMs: number): Record<string, string> {
  const gate = Buffer.from(`${epochMs}||/graphql/search`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Origin: AGODA_WEB,
    'AG-LANGUAGE-LOCALE': 'en-us',
    'AG-CID': '-1',
    'AG-PAGE-TYPE-ID': '103',
    'AG-RETRY-ATTEMPT': '0',
    'AG-REQUEST-ATTEMPT': '1',
    'Access-Control-Max-Age': '7200',
    'x-gate-meta': gate,
    ...(cfg.correlationId ? { 'AG-CORRELATION-ID': cfg.correlationId } : {}),
    ...(cfg.analyticsSessionId ? { 'AG-ANALYTICS-SESSION-ID': cfg.analyticsSessionId } : {}),
  };
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');

/** Full GraphQL document (selection: propertyId, content, pricing). */
export const AGODA_CITY_SEARCH_QUERY =
  'query citySearch($CitySearchRequest: CitySearchRequest!, $ContentSummaryRequest: ContentSummaryRequest!, $PricingSummaryRequest: PricingRequestParameters) { citySearch(CitySearchRequest: $CitySearchRequest) { properties(ContentSummaryRequest: $ContentSummaryRequest, PricingSummaryRequest: $PricingSummaryRequest) { propertyId content { informationSummary { displayName accommodationType address { city { name } } geoInfo { latitude longitude } rating } images { hotelImages { id urls { key value } } } reviews { cumulative { reviewCount score } } } pricing { isAvailable offers { roomOffers { room { pricing { currency price { perNight { exclusive { display originalPrice } inclusive { display originalPrice } } } } } } } } } } }';

/** Variables document rebuilt from webpack module 379728 (see file header). */
export function buildAgodaCitySearchVars(cityId: number, checkin: string, checkout: string): Record<string, any> {
  const inMs = Date.parse(`${checkin}T00:00:00Z`);
  const outMs = Date.parse(`${checkout}T00:00:00Z`);
  const los = Number.isFinite(outMs) && outMs > inMs ? Math.max(1, Math.round((outMs - inMs) / 86_400_000)) : 1;
  const ci = `${checkin}T00:00:00.000Z`;
  const co = new Date(inMs + los * 86_400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const now = nowIso();
  const searchId = crypto.randomUUID();
  return {
    CitySearchRequest: {
      cityId,
      searchRequest: {
        searchCriteria: {
          bookingDate: now, checkInDate: ci, los, rooms: 1, adults: 2, children: 0, childAges: [],
          currency: 'INR', sorting: { sortField: 'Ranking', sortOrder: 'Desc' },
          requiredBasis: 'PRPN', requiredPrice: 'Exclusive', isUserLoggedIn: false,
          travellerType: 'AllGuests', ratePlans: [], suggestionLimit: 0,
          synchronous: false, isRoomSuggestionRequested: false,
        },
        searchContext: {
          locale: 'en-us', cid: -1, origin: 'US', platform: 1, deviceTypeId: 1, storefrontId: 3,
          pageTypeId: 103, endpointSearchType: 'CitySearch', searchId, userId: '', memberId: 0,
          experiments: { forceByVariant: null, forceByExperiment: [{ id: 'JGCW-204', variant: 'B' }] },
          isRetry: false, showCMS: false, whiteLabelKey: '', ipAddress: null,
        },
        page: { pageSize: 30, pageNumber: 1 },
      },
    },
    ContentSummaryRequest: {
      context: {
        rawUserId: '', memberId: 0, userOrigin: 'US', locale: 'en-us', apo: false,
        searchCriteria: { cityId }, platform: { id: 1 }, storefrontId: 3, cid: '-1',
        occupancy: { numberOfAdults: 2, numberOfChildren: 0, checkIn: ci },
        deviceTypeId: 1, whiteLabelKey: '', correlationId: '',
        forceExperimentsByIdNew: [{ key: 'JGCW-204', value: 'B' }],
      },
      summary: { highlightedFeaturesOrderPriority: null, includeHotelCharacter: false },
      reviews: {
        commentary: null,
        demographics: { providerIds: null, filter: { defaultProviderOnly: true } },
        summaries: { providerIds: null, apo: true, limit: 1 },
        cumulative: { providerIds: null }, filters: null,
      },
      images: { page: null, maxWidth: 0, maxHeight: 0, imageSizes: null, indexOffset: null },
      rooms: {
        images: null, featureLimit: 0, filterCriteria: null, includeMissing: false,
        includeSoldOut: false, includeDmcRoomId: false, soldOutRoomCriteria: null,
        showRoomSize: true, showRoomFacilities: true, showRoomName: false,
      },
      nonHotelAccommodation: true, engagement: true,
      highlights: { maxNumberOfItems: 0, images: { imageSizes: [{ key: 'full', size: { width: 0, height: 0 } }] } },
      personalizedInformation: true, localInformation: { images: null }, features: null,
      rateCategories: null, contentRateCategories: null, synopsis: true,
    },
    PricingSummaryRequest: {
      cheapestOnly: true, isSSR: true,
      context: {
        isAllowBookOnRequest: false,
        abTests: [9021, 9023, 9024, 9025, 9027, 9029].map((testId) => ({ testId, abUser: 'B' })),
        clientInfo: {
          cid: -1, languageId: 1, languageUse: 1, origin: 'US', platform: 1,
          searchId: crypto.randomUUID(), storefront: 3, userId: '', ipAddress: null,
        },
        experiment: [{ name: 'JGCW-204', variant: 'B' }],
        sessionInfo: { isLogin: false, memberId: 0, sessionId: 1 },
      },
      pricing: {
        bookingDate: now, checkIn: ci, checkout: co, currency: 'INR',
        details: { cheapestPriceOnly: false, itemBreakdown: false, priceBreakdown: false },
        filters: { cheapestRoomFilters: null, filterAPO: false, ratePlans: [1], secretDealOnly: false, suppliers: [] },
        features: {
          calculateRareRoomBadge: false, crossOutRate: false, isAPSPeek: false, isAllOcc: false,
          isApsEnabled: false, isIncludeUsdAndLocalCurrency: false, isMSE: true, isRPM2Included: true,
          maxSuggestions: 0, isEnableSupplierFinancialInfo: false, isLoggingAuctionData: false,
          newRateModel: false, overrideOccupancy: false, filterCheapestRoomEscapesPackage: false,
          priusId: 0, synchronous: false, enableRichContentOffer: false,
          showCouponAmountInUserCurrency: false, disableEscapesPackage: false,
          enablePushDayUseRates: false, enableDayUseCor: false, ignoreRoomsCountForNha: false,
          enableSuggestPriceExclusiveWithFees: false,
        },
        includedPriceInfo: false,
        occupancy: { adults: 2, children: 0, rooms: 1, childAges: [] },
        requiredBasis: 'PRPN', requiredPrice: 'Exclusive', ratePlans: [],
        sorting: { sortField: 'Ranking', sortOrder: 'Desc' },
      },
      suggestedPrice: 'Exclusive',
    },
  };
}

/** Defensively read data.citySearch.properties[] from the GraphQL response. */
export function extractAgodaProperties(gql: any): any[] {
  const props = gql?.data?.citySearch?.properties;
  return Array.isArray(props) ? props : [];
}

export function parseAgodaHotels(props: any[]): AgodaHotel[] {
  const first = (v: any): any => (Array.isArray(v) && v.length ? v[0] : undefined);
  const out: AgodaHotel[] = [];
  for (const p of props) {
    if (!p || typeof p !== 'object') continue;
    const info = p.content?.informationSummary || {};
    const name = String(info.displayName || '').trim();
    const propertyId = String(p.propertyId || '').trim();
    if (!name || !/^\d+$/.test(propertyId)) continue;

    const rev = p.content?.reviews?.cumulative;
    let score: number | null = null;
    let reviews: number | null = null;
    if (rev && typeof rev === 'object') {
      score = typeof rev.score === 'number' ? rev.score : null;
      reviews = typeof rev.reviewCount === 'number' ? rev.reviewCount : null;
    }

    // pricing.offers is a LIST of { roomOffers: [...] } (cheapestOnly:true → 1 entry)
    const offer = first(p.pricing?.offers);
    const roomOffer = first(offer?.roomOffers);
    // room.pricing is a LIST with a single currency-priced entry
    const pricing = first(roomOffer?.room?.pricing) || {};
    const perNight = pricing?.price?.perNight || {};
    const exclusive = perNight?.exclusive?.display;
    const inclusive = perNight?.inclusive?.display;
    const pricePerNight = typeof exclusive === 'number' ? exclusive : (typeof inclusive === 'number' ? inclusive : null);
    const priceInclusive = typeof inclusive === 'number' ? inclusive : null;

    const imgEntry = first(first(p.content?.images?.hotelImages)?.urls);
    const rawImg = typeof imgEntry?.value === 'string' ? imgEntry.value : null;
    const imageUrl = rawImg ? (rawImg.startsWith('//') ? `https:${rawImg}` : rawImg) : null;

    out.push({
      propertyId,
      name,
      accommodationType: info.accommodationType != null ? String(info.accommodationType) : null,
      cityName: info.address?.city?.name ? String(info.address.city.name) : null,
      score, reviews,
      pricePerNight, priceInclusive,
      currency: String(pricing.currency || 'INR'),
      imageUrl,
      lat: typeof info.geoInfo?.latitude === 'number' ? info.geoInfo.latitude : null,
      lon: typeof info.geoInfo?.longitude === 'number' ? info.geoInfo.longitude : null,
      available: p.pricing?.isAvailable === true,
    });
  }
  return out;
}

/** Price-only comparison offers: seller is Agoda, redirect only to Agoda. */
export function parseAgodaOffers(
  hotels: AgodaHotel[],
  source: SourceConfig,
  city: string,
  meta: { cityId: number; checkin: string; los: number },
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const srpUrl = `${AGODA_WEB}/search?city=${meta.cityId}&checkIn=${meta.checkin}&los=${meta.los}`;
  for (const h of hotels.slice(0, 25)) {
    if (!h.pricePerNight) continue; // never publish a price we did not see
    const attrs: Record<string, any> = {
      image_url: h.imageUrl,
      rating: h.score != null ? String(h.score / 10) : null, // Agoda scores are /10 → /5 scale
      review_count: h.reviews,
      city: h.cityName || city,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.propertyId,
      price_basis: h.priceInclusive != null
        ? `per night on Agoda (tax-exclusive ₹${Math.round(h.pricePerNight)}; inclusive ₹${Math.round(h.priceInclusive)})`
        : 'per night on Agoda (tax-exclusive)',
      data_note: 'Live per-night rates observed on Agoda search',
    };
    out.push(newRawItem(source, {
      title: h.name,
      seller: 'Agoda',
      sellerUrl: srpUrl, // redirect only to the site that owns the price
      currency: h.currency,
      price: Math.round(h.pricePerNight),
      attributes: attrs,
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.propertyId,
        extractedFields: ['title', 'price', 'rating', 'review_count', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}
