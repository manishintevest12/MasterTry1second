/**
 * SearchOrchestrator (Section 6): the end-to-end pipeline.
 *
 * USER SEARCH → query understanding → vertical detection → entity extraction →
 * L1 cache → L2 redis → L3 MySQL catalogue → eligible fresh results returned →
 * targeted incremental refresh → parallel independent acquisition → parsing →
 * normalization → entity/variant/seller matching → price/fee/currency validation →
 * availability/freshness validation → evidence → persist + price history → cache →
 * rank comparable offers → affiliate deep links.
 *
 * Honesty rules enforced here:
 *  - No enabled sources → honest "unavailable" state with a clear notice. NEVER fake results.
 *  - Cached data is labeled CACHED_VERIFIED, never LIVE_VERIFIED.
 *  - Slow sources never block verified results (progressive, bounded parallel acquisition).
 */
import type { AdapterResult, NormalizedOffer, ParsedQuery, SearchResponse, SearchStateFlags, SourceConfig } from '../types';
import { recordSourcePrices, enrichFailedWithLastPrice } from '../common/lastPrice';
import { buildCacheKey, cacheGet, cachePut, cacheDel, revalidateInBackground } from '../common/cache';
import { log } from '../common/logger';
import { firstPaintMs, resultDeadlineMs } from './latencyBudget';
import { aiAssistedUnderstanding, understandQuery } from '../query/queryUnderstanding';
import { selectSources } from '../sources/registry';
import { acquireParallel } from '../sources/orchestrator';
import type { AcquisitionOutcome } from '../sources/orchestrator';
import { dedupeOffers, normalizeOffer } from '../pipeline/normalization';
import { validateOffer } from '../pipeline/validation';
import { computeEffectivePrice } from '../pipeline/pricing';
import { computeFreshness, isServable } from '../pipeline/freshness';
import { withBrandImages, withLenderLogos, withMerchantLogos, stripMerchantLogoFallbacks, withCardArt, stripCardLogoStandIns } from '../pipeline/brandImage';
import { withProductImages } from '../pipeline/productImages';
import { resolveCanonicalEntity } from '../pipeline/entityMatching';
import { rankOffers } from '../pipeline/ranking';
import { passesQueryRelevance } from './queryRelevance';
import { filterRowsForDepartment, getEcomDepartment, resolveEcomDepartment, rowHasCategoryEvidence, rowMatchesDepartment } from '../lens/ecomDepartments';
import { backfillRowImages, collapseSellerVariants, gateFeedProductRows } from './productMatchGate';
import { buildFlightSellerPresence, PRESENCE_SHOW_ON_EMPTY_IDS } from './sellerPresence';
import { getVerticalEngine } from '../verticals/verticalEngine';
import { findCatalogueOffers, persistOffer, recordPriceSnapshot, type CatalogueRow } from '../catalogue/catalogueService';
import { enrichFlightSchedules } from '../common/flightSchedule';
import { filterByNamedProviders } from '../verticals/verticalEngine';
import { attachAffiliateDeepLinks } from '../affiliate/affiliateNetwork';

export interface SearchInput {
  query: string;
  vertical?: string;
  pincode?: string;
  city?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  /** Explicit travel dates from the frontend (YYYY-MM-DD); override defaults when present. */
  travelDates?: { depart?: string; return?: string };
  guests?: number;
  /**
   * Per-request ceiling on the COLD first-paint wait (owner 27 Oct, "1 second ke andar
   * results chahiye"). The product page passes ~900ms: it answers with whatever real rows
   * exist by then and keeps the rest arriving via pendingRefresh polling. Other verticals
   * keep the 3.2s default so their slow sources still make the first paint.
   */
  coldDeadlineMs?: number;
  /** Explicit pickup/drop labels (cab, owner 25 Oct): the app's granular picker
   * knows the exact Photon label + city; regex route extraction from rawQuery
   * loses the city for bare locality names ("Rajwada" -> Nashik). */
  from?: string;
  to?: string;
}

function parseCatalogueAttributes(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
}

function rowToOffer(row: CatalogueRow, isLiveNow: boolean): NormalizedOffer {
  // Catalogue rows are re-validated for freshness; a stored LIVE_VERIFIED label is
  // downgraded to CACHED_VERIFIED when served from storage (Section 9 rule).
  const status = row.freshness_status === 'LIVE_VERIFIED' ? 'CACHED_VERIFIED' : (row.freshness_status as any);
  return {
    id: `cat_${row.id}`,
    canonicalEntityId: row.canonical_entity_id ?? null,
    canonicalVariantId: null,
    vertical: row.vertical as any,
    title: row.title,
    identifiers: {},
    // Catalogue rows persist their full attribute set (image_url, rating, city, gallery...).
    // Hydrate it — dropping it left every replayed hotel/flight row image-less, which
    // surfaced as the recurring "photo not published by source" placeholder bug.
    attributes: parseCatalogueAttributes(row.attributes),
    vendor: row.vendor,
    seller: row.seller,
    sellerUrl: row.seller_url || undefined,
    brand: row.brand || undefined,
    // The offers table has no travel column; parsers persist route/date as
    // attributes. Hydrate o.travel from them so flight group keys (flight no +
    // date + dep time) survive the catalogue path (owner 22 Oct grouping bug).
    travel: (() => {
      const a: any = parseCatalogueAttributes(row.attributes);
      return a?.route || a?.travel_date ? { route: a.route, date: a.travel_date } : undefined;
    })(),
    location: { pincode: row.location_pincode || undefined, city: row.location_city || undefined },
    prices: {
      listPrice: row.mandatory_total ?? undefined,
      mandatoryTotal: row.mandatory_total ?? undefined,
      effectivePrice: row.effective_price ?? undefined,
      currency: row.currency,
      fees: {},
    },
    availability: (row.availability as any) || 'unknown',
    matchState: 'MATCHED',
    freshnessStatus: isServable(status as any) ? status as any : 'STALE',
    validationStatus: (row.validation_status as any) || 'PARTIAL',
    confidence: Number(row.confidence) || 0.5,
    provenance: {
      sourceId: row.source_id,
      sourceMethod: 'cached_catalogue',
      adapterVersion: '-',
      parserVersion: '-',
      fetchedAt: row.fetched_at,
    },
  };
}

/**
 * Cache policy (Section 8, tuned for instant page loads):
 *   Travel (flights/hotels/bus/cab/movies) — fares move: 5 min fresh, 15 min stale-serve.
 *   Everything else (ecommerce/grocery/food/…) — 15 min fresh, 45 min stale-serve.
 * Stale responses are served IMMEDIATELY (milliseconds) while a background refresh
 * re-acquires live prices. Fresh results are only ever as old as the TTL above.
 */
function searchCacheTtl(vertical: string): { ttlSec: number; staleSec: number } {
  // Owner 29 Oct ("movies, ecommerce, credit card ye sb har samay change ni hote — din me ek
  // baar peeche se chale aur data real time sab ko mile"): a film's showtimes, a phone's
  // listed price and a bank's card table move at most once a day. They now share the finance
  // policy — 24h fresh / 48h stale-while-revalidate — so every user reads the saved
  // catalogue instantly and the ONE daily live refresh happens in the keep-warm rotation
  // (DAILY_CATALOGUE_SEEDS) instead of on each request.
  if (['movies', 'ecommerce', 'creditcards'].includes(vertical)) return { ttlSec: 86_400, staleSec: 172_800 };
  if (['flights', 'hotels', 'bus', 'cab'].includes(vertical)) return { ttlSec: 300, staleSec: 900 };
  // Owner 23 Oct ("loan, insurance, credit card, bank account ka data change ni
  // hota frequently — save kr ke result fast do, din me ek baar scrap krwao"):
  // these finance segments publish rate/card/account tables that move at most
  // daily, and the freshness engine already credits them 24h fresh
  // (VERTICAL_DEFAULT_TTL 86400). The generic 15-min search TTL was forcing a
  // full live re-scrape every 15 minutes for data that had not changed — the
  // segment felt slow because each expiry meant a 5-20s pipeline. Now: 24h
  // fresh + 48h stale-serve (stale-while-revalidate refreshes in the background
  // on the first stale hit). User searches are instant cache hits; the keep-warm
  // rotation performs the ONE daily live scrape per query.
  if (['loans', 'insurance', 'creditcards', 'banking'].includes(vertical)) return { ttlSec: 86_400, staleSec: 172_800 };
  return { ttlSec: 900, staleSec: 2700 };
}

/**
 * Owner 24 Oct ("redbus/abhibus ka result kabhi aata hai kabhi ni aata hai —
 * permanently fix"): a BUS response whose live pipeline ATTEMPTED a primary
 * live source (AbhiBus or redBus) but carries no rows from it is a tarpit
 * window being observed, not the truth for the next 5 minutes. Cache such a
 * response for only 2 minutes (stale-serve 4) so the very next poll re-attempts
 * the missing source and the gap self-heals, instead of sitting behind the
 * normal 5/15-min bus TTL. Sources that were not even attempted (circuit) keep
 * the full window (nothing to re-attempt this cycle).
 */
const BUS_PRIMARY_LIVE_SELLERS = ['abhibus', 'redbus'];
export function busSelfHealTtl(vertical: string, response: SearchResponse, ttlSec: number, staleSec: number): { ttlSec: number; staleSec: number } {
  if (vertical !== 'bus' || !response.results?.length) return { ttlSec, staleSec };
  const attempted = (response.state?.sourcesAttempted || []) as unknown as string[];
  const sellers = (response.results as any[]).map((o) => String(o?.seller || '').toLowerCase());
  for (const seller of BUS_PRIMARY_LIVE_SELLERS) {
    const wasAttempted = attempted.some((x) => String(x).includes(seller));
    if (wasAttempted && !sellers.includes(seller)) return { ttlSec: 120, staleSec: 240 };
  }
  return { ttlSec, staleSec };
}

/**
 * Thin-result poison guard (owner 25 Oct "app pr ek hi result, website pr sb"):
 * a COMPLETED scan that verified 5+ sources but landed <=2 rows is a tarpit
 * snapshot (all live sources gated that instant, only a catalogue row
 * survived) — e.g. the 403-era e-commerce snapshot that served 1 JioMart row
 * with 11 sources "verified" and stopped the app's poll chain. Cache such a
 * response for only 2 minutes so the very next poll re-scans and the snapshot
 * self-heals, instead of serving as a fresh cache hit for the full TTL.
 * Healthy scans keep the full window.
 */
export function thinResultTtl(response: SearchResponse, ttlSec: number, staleSec: number): { ttlSec: number; staleSec: number } {
  const n = response.results?.length || 0;
  const succeeded = (response.state?.sourcesSucceeded || []).length;
  if (n <= 2 && succeeded >= 5) return { ttlSec: 120, staleSec: 240 };
  return { ttlSec, staleSec };
}

/**
 * PROGRESSIVE COLD-START (21 Oct, owner request): a cold cache must never block
 * the UI for 6-40s while live sources acquire. If the L3 catalogue holds fresh
 * (<1h) validated rows for the vertical, they are returned IMMEDIATELY as real
 * (honest) partial results and the full live pipeline continues in the
 * background (deduped per cacheKey). Clients re-post the same search a few
 * seconds later and pick up the completed live response from cache; the
 * response's state.pendingRefresh tells them a refresh is still running.
 */
const inflightPipelines = new Map<string, Promise<SearchResponse>>();
/** Newest live partial snapshot per cacheKey while a cold pipeline runs (owner 22 Oct):
 *  a re-poll must serve the sources that have ALREADY landed instead of blocking on
 *  the full pipeline. `response` memoizes the finalized partial until a newer
 *  snapshot arrives (each onPartial invalidates it). */
interface InflightPartial { snap: AcquisitionOutcome; response: SearchResponse | null }
const inflightPartials = new Map<string, InflightPartial>();

async function progressiveCatalogueResponse(
  vertical: string,
  inputQuery: ParsedQuery,
  offers: any[],
  start: number,
  pending: boolean
): Promise<SearchResponse> {
  const anyOffers = offers as any[];
  // Owner 22 Oct: the instant catalogue partial paints before live rows land —
  // gated-seller presence rows (Yatra/IndiGo/Akasa/Expedia) must appear here too,
  // not just in the finalized full response.
  if (String(vertical) === 'flights') {
    const presence = await buildFlightSellerPresence(inputQuery, anyOffers);
    // The catalogue partial skips the full pipeline's image steps, so brand
    // logos are resolved here for the injected rows (cheap favicon chain).
    if (presence.length) anyOffers.push(...withBrandImages(presence));
  }
  for (const o of anyOffers) {
    if (o.freshnessStatus === 'LIVE_VERIFIED') o.freshnessStatus = 'CACHED_VERIFIED';
    if (o.provenance) o.provenance.replayedFromCache = true;
  }
  return {
    query: inputQuery,
    results: anyOffers,
    state: {
      servedFrom: 'catalogue',
      sourcesAttempted: [],
      sourcesSucceeded: [],
      sourcesFailed: [],
      reusedCatalogue: true,
      triggeredRefresh: true,
      pendingRefresh: pending,
    },
    latencyMs: Date.now() - start,
    totalSearchLatencyMs: Date.now() - start,
  } as SearchResponse;
}

/**
 * Catalogue cold-start rows are query-gated for product-name verticals (owner rule,
 * verified bug 22 Oct: back-to-back searches served the PREVIOUS query's rows —
 * 'washing machine' returned NIKE shoes from a 'nike shoes' search minutes earlier
 * because the catalogue lookup is vertical-wide with no query dimension). The
 * same passesQueryRelevance gate the supplementary path uses (line ~337) applies
 * here, so an instant cold-start only shows rows that match the typed query.
 * Route verticals (flights/bus/cab/hotels) are exempt: their rows are keyed by
 * route/city attributes the token gate cannot see, and they keep their own
 * strict filters.
 */
/**
 * Owner 23 Oct ('3-2-1 countdown khtm hote hi results aane chahiye'): a fully cold
 * query whose sources are all still mid-flight must NOT hang the caller until the
 * slowest source settles (ecom cold first rows took 30-40s -> the app's 30s HTTP
 * timeout killed the search and the owner saw the empty state). When the 3s
 * loader countdown ends with no live row yet and nothing honest to borrow from
 * the catalogue, return this EMPTY pendingRefresh marker instead: the app polls
 * every 2s and the PROGRESSIVE POLL branch streams partial rows in as each
 * source lands. Nothing is fabricated — zero rows is the truth at this instant.
 */
async function stillAcquiringResponse(parsed: ParsedQuery, start: number): Promise<SearchResponse> {
  return {
    query: parsed,
    results: [],
    state: {
      servedFrom: 'unavailable',
      sourcesAttempted: [],
      sourcesSucceeded: [],
      sourcesFailed: [],
      reusedCatalogue: false,
      triggeredRefresh: true,
      pendingRefresh: true,
      honestNotice: 'Live sources are still scanning for exactly what you typed — results start arriving within seconds.',
    },
    latencyMs: Date.now() - start,
    totalSearchLatencyMs: Date.now() - start,
  } as SearchResponse;
}

const RELEVANCE_GATED_CATALOGUE = new Set(['ecommerce', 'grocery', 'food', 'movies', 'movie']);

/** Owner 23 Oct (destination-matrix audit): the bus/flights cold-start floor
 * borrowed ANY recent row from the origin city — 'Indore to Shirdi' painted
 * Indore->Bhopal/Goa buses until the live pass landed. A borrowed row must now
 * carry the queried DESTINATION (and origin) in its route text; no honest
 * match -> no borrowed rows (the first live row paints instead — never a
 * wrong-route row). Non-route queries keep the previous behaviour untouched. */
export function routeFloorMatches(
  rawQuery: string | undefined,
  offer: { title?: string; subtitle?: string; travel?: { route?: string }; attributes?: Record<string, unknown> | null },
): boolean {
  const q = String(rawQuery || '').toLowerCase();
  const sides = q.split(/\s+to\s+/);
  if (sides.length < 2) return true; // not a route query -> old behaviour
  const parens = /\([^)]*\)/g;
  const tokens = (side: string) => side
    .replace(parens, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !['the', 'and'].includes(t));
  const dest = tokens(sides[sides.length - 1]);
  const origin = sides.length > 2 ? tokens(sides[1]) : tokens(sides[0]);
  if (!dest.length) return true;
  const attrs = offer.attributes || ({} as Record<string, unknown>);
  // Owner 24 Oct ("indore se mumbai bola to indore-delhi dikha raha hai"): the
  // old check searched the WHOLE title text, so a borrowed Delhi-route row
  // whose title merely MENTIONED the destination ("... via Mumbai · Indore →
  // Delhi") passed the floor and painted wrong-route itineraries on the first
  // partial of a fresh route. A borrowed row must now DECLARE a route whose
  // ENDPOINTS match: the row's origin side names a queried origin token and
  // its destination side names a queried destination token. No parseable
  // route -> cannot prove relevance -> never borrowed.
  const sideText = (t: string) => t.toLowerCase().replace(parens, ' ');
  const hits = (rowSide: string, toks: string[]) => {
    const s = sideText(rowSide);
    return toks.some((t) => new RegExp(`\\b${t}\\b`).test(s));
  };
  const matches = (declared: { originSide: string; destSide: string }) =>
    hits(declared.destSide, dest) && (!origin.length || hits(declared.originSide, origin));
  // Route-bearing attributes first, parsed independently (a travel.route field
  // never contains sentence noise); then, only when no route attribute exists,
  // the title+subtitle text.
  const routeFields = [offer.travel?.route, typeof attrs.route === 'string' ? attrs.route : '']
    .map((f) => String(f || '').trim()).filter(Boolean);
  for (const f of routeFields) {
    const d = declaredRouteSides(f);
    if (d && matches(d)) return true;
  }
  const declared = declaredRouteSides(`${offer.title || ''} ${offer.subtitle || ''}`);
  if (!declared) return false;
  return matches(declared);
}

/** Parse a row's declared route out of its route-bearing text. Separators are
 * unicode arrows, "->" or the word "to". For multi-leg itineraries
 * ("Indore → Mumbai → Delhi") the overall route is first-endpoint to
 * last-endpoint. Returns null when no route is declared. */
function declaredRouteSides(text: string): { originSide: string; destSide: string } | null {
  const re = /(?:\u2192|->|\s+to\s+)/gi;
  const seps: { idx: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    seps.push({ idx: m.index, len: m[0].length });
    if (seps.length > 8) break; // defensive: absurd text, treat as unparseable
  }
  if (seps.length === 0) return null;
  const first = seps[0];
  const last = seps[seps.length - 1];
  return { originSide: text.slice(0, first.idx), destSide: text.slice(last.idx + last.len) };
}

/**
 * CITY GATE (owner 28 Oct, second attempt). First attempt required `location_city = city` in SQL
 * and that REGRESSED the feed: the photo-rich rows from most sources carry no location_city at
 * all, so hotels/Indore dropped from 262 rows/8 sellers/247 photos to 40 photoless rows.
 * The rule is now the narrower, honest one: keep a row whose city matches or is unknown, but drop
 * a row that NAMES a different major city (that is how Goa hotels appeared under 'Indore').
 */
const MAJOR_CITIES = [
  'goa', 'mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
  'pune', 'jaipur', 'udaipur', 'jodhpur', 'agra', 'varanasi', 'lucknow', 'kanpur', 'nagpur', 'nashik',
  'ahmedabad', 'surat', 'vadodara', 'rajkot', 'indore', 'bhopal', 'gwalior', 'jabalpur', 'raipur',
  'chandigarh', 'amritsar', 'ludhiana', 'dehradun', 'shimla', 'manali', 'rishikesh', 'haridwar',
  'kochi', 'cochin', 'trivandrum', 'thiruvananthapuram', 'coimbatore', 'madurai', 'mysore', 'mysuru',
  'mangalore', 'vizag', 'visakhapatnam', 'vijayawada', 'bhubaneswar', 'patna', 'ranchi', 'guwahati',
  'srinagar', 'jammu', 'ajmer', 'pushkar', 'mount abu', 'lonavala', 'mahabaleshwar', 'nainital',
  'mussoorie', 'darjeeling', 'gangtok', 'shillong', 'pondicherry', 'puducherry', 'varkala',
  'alleppey', 'alappuzha', 'munnar', 'wayanad', 'kodaikanal', 'ooty', 'gurgaon', 'gurugram',
  'noida', 'faridabad', 'ghaziabad', 'thane', 'navi mumbai', 'secunderabad', 'vapi', 'siliguri',
];

export function namesOtherCity(text: string, city?: string): boolean {
  if (!city) return false;
  const hay = String(text || '').toLowerCase();
  const want = String(city || '').toLowerCase().trim();
  if (!hay || !want) return false;
  if (hay.includes(want)) return false; // it names the city we asked for
  return MAJOR_CITIES.some((c) => c !== want && new RegExp(`\\b${c}\\b`).test(hay));
}

/** Floor windows per vertical (owner 28 Oct): travel rows are fetched in cycles, so a bus/hotel
 *  answer older than an hour is still the honest last-verified fare. Exported for tests. */
export function floorWindows(vertical: string): { strict: number; fallback: number } {
  const travelish = vertical === 'flights' || vertical === 'hotels' || vertical === 'bus' || vertical === 'cab';
  return travelish ? { strict: 3600, fallback: 24 * 3600 } : { strict: 24 * 3600, fallback: 72 * 3600 };
}

/** Age window filter shared by the strict floor and its fallback (exported for tests). */
export function filterRowsByAge(rows: any[], maxAgeSec: number, now = Date.now()): any[] {
  return rows.filter((r) => (now - new Date(r.fetched_at).getTime()) / 1000 < maxAgeSec && r.validation_status !== 'INVALID');
}

/**
 * OWNER 28 Oct ('bus, food, movies ni de raha'): the cold-start floor only accepted rows
 * younger than ONE HOUR for travel verticals (bus/flights/cab/hotels). A bus route whose
 * sources are gated for a few hours therefore had NO floor at all — the first paint was
 * literally empty while a perfectly good last-verified fare sat in MySQL. The floor now
 * retries the same query — same route gate, same relevance gate — with a wider window
 * (24h for travel, 72h elsewhere) when the strict window cannot fill it. The rows are the
 * same rows the app already shows as "last verified"; nothing is invented, and the live
 * pipeline still replaces them seconds later.
 */
async function freshCatalogueOffers(
  vertical: string,
  input: SearchInput,
  parsed: ParsedQuery,
  maxAgeSec = 3600,
  fallbackMaxAgeSec?: number,
): Promise<any[]> {
  // Route/product terms so the floor's candidate set is ABOUT this query (see the
  // query-aware lookup in catalogueService); the vertical's own route/relevance gates below
  // still decide what is finally painted.
  const STOPWORDS = new Set(['to', 'from', 'in', 'at', 'for', 'the', 'and', 'near', 'me', 'on', 'of', 'a', 'an', 'best', 'cheap', 'cheapest', 'price', 'under', 'hotels', 'hotel', 'bus', 'buses', 'flights', 'movies', 'tickets']);
  const queryTerms = String(parsed.rawQuery || input.query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  // Preference, never a filter: a query term narrows the candidate set to rows ABOUT this
  // search, and when the catalogue words the row differently ("DEL → BOM" for "delhi to
  // mumbai", "HP 15s" for "Laptops") the plain lookup still runs, so the floor can never be
  // emptier than it was before.
  let rows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40, queryTerms });
  if (!rows.length) rows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  // Drop rows that name a different major city (Goa properties under an Indore search).
  // Rows whose city is simply unknown stay: they are the ones that carry real photos.
  const cityGate = (r: any) =>
    !namesOtherCity(`${r.title || ''} ${r.subtitle || ''} ${typeof r.attributes === 'string' ? r.attributes : JSON.stringify(r.attributes || {})}`, input.city);
  const cityRows = rows.filter(cityGate);
  const usable = cityRows.length >= 4 ? cityRows : rows;
  const strict = filterRowsByAge(usable, maxAgeSec, now);
  // Only reach for older rows when the strict window is thin; the caller needs >=4 rows
  // to paint a floor at all, and a stale-but-real fare beats an empty page.
  const window = strict.length >= 4 || !fallbackMaxAgeSec ? strict : filterRowsByAge(usable, fallbackMaxAgeSec, now);
  let offers = window.map((r) => rowToOffer(r, false));
  // Department browse (owner 29 Oct): the catalogue is vertical-wide and holds every
  // category at once, so a tab tap must be judged by ITS category - the phone-family
  // token gate is both too strict (it dropped tablets/TVs promised by the tab) and too
  // loose (a "Smartphone Compatible" SSD passed it).
  const browseDept = getEcomDepartment((input as any).browseDepartmentId);
  if (browseDept) {
    // Catalogue replay is a vertical-wide dump, so a department needs POSITIVE category
    // evidence here ("HP 15s-fq5329TU" is a laptop by brand/model, "SanDisk SSD" is not a
    // phone). Live rows below are judged on the weaker blocklist instead, because they
    // were fetched by the department's own acquisition term.
    offers = (offers as any[]).filter((o) => {
      const title = String(o?.title || '');
      if (!rowMatchesDepartment(title, browseDept)) return false;
      const brand = String(o?.brand || o?.attributes?.brand || '');
      return rowHasCategoryEvidence(title, brand, browseDept);
    });
  } else if (RELEVANCE_GATED_CATALOGUE.has(vertical)) {
    offers = offers.filter((o) => passesQueryRelevance(o, parsed));
  }
  // Route-aware floor (owner 23 Oct): bus/flights borrowed rows must name the
  // queried route, or the floor is skipped for that row — never show a
  // wrong-route bus/flight during the cold-start window.
  if (vertical === 'bus' || vertical === 'flights' || vertical === 'cab') {
    // Owner 23 Oct ("rapido ni aa raha" follow-up): the cab cold-start floor
    // borrowed ANY recent intra-city row from the same city — "Bhawarkuan to
    // Rajwada" painted "Palasia to Rajwada" rows. Same strict route gate as
    // bus/flights: a borrowed cab row must name the queried origin AND
    // destination, or the floor is skipped for that row.
    offers = offers.filter((o) => routeFloorMatches(parsed.rawQuery ?? input.query, o));
  }
  // Hotel art gate (owner 28 Oct, 'results mai image ni aaya'): catalogue rows written by
  // pre-gallery batches carry no photo, so the floor painted a booking-site logo where the
  // property should be. Photo-bearing rows win the floor; photoless rows are allowed only
  // when nothing better exists (they then render the honest placeholder, never a logo).
  if (vertical === 'hotels') {
    const withPhoto = offers.filter((o: any) => {
      const u = String(o.attributes?.image_url || o.attributes?.image || '');
      return u && !/s2\/favicons|brand-logos\//.test(u);
    });
    if (withPhoto.length >= 4) offers = withPhoto;
  }
  // Bank search bar (owner 21 Oct): a query that NAMES a provider must not serve every
  // other bank's catalogue rows during the instant cold-start window. Apply the SAME
  // provider rule the live pipeline's engine filter uses.
  // Owner 22 Oct ("bahut saare vertical mai image ni aa raha"): the progressive
  // cold-start path skipped the brand-image pipeline entirely, so every instant
  // catalogue card (account/banking rows have no seller/vendor to self-serve an
  // image) rendered blank. Attach the same brand/lender favicons the live pipeline
  // uses; the live pass then upgrades them to crisp Wikidata logos where available.
  return withBrandImages(filterByNamedProviders(offers, parsed?.entityName) as any[]) as any[];
}

/**
 * Owner 23 Oct (3s-countdown sync): runSearch now returns a fast pendingRefresh
 * marker/partial on cold queries instead of waiting for the slowest source.
 * That is exactly right for the app/web feed (progressive polls top it up),
 * but SERVER-SIDE consumers that build a COMPLETE view from one call — product
 * page compare offers, scan competitor quotes, grocery basket compare, insight
 * spreads — need the settled set. This wrapper polls the same query until the
 * pipeline stops refreshing (or the bounded deadline), returning the fullest
 * response seen. Polls are cheap: they coalesce onto the inflight pipeline and
 * serve partial snapshots within 600ms.
 */
/**
 * Fast path (owner 27 Oct): "we need fast results" — 8s budget was used even when
 * rows already existed, because the poll loop kept waiting while a background
 * refresh was pending. This returns the FIRST usable snapshot:
 *   1. cached/live rows from a single runSearch pass  -> ~50ms when cache is warm
 *   2. if that pass is empty, one short extra pass (sources often need a beat)
 * It never waits on pendingRefresh: refresh continues in the background and the
 * next request is served from cache.
 */
export async function runSearchFast(input: SearchInput, coldBudgetMs = 1_500): Promise<SearchResponse> {
  const fast = await runSearchFastInner(input, coldBudgetMs);
  return gateEcommerceResponse(input, fast);
}

async function runSearchFastInner(input: SearchInput, coldBudgetMs = 1_500): Promise<SearchResponse> {
  const started = Date.now();
  // One shared 3s wait no matter how many callers join: poll the SAME pipeline until real
  // rows exist. Returning an empty "still acquiring" marker here is what made the product
  // page paint 'Price unavailable' while sources were still landing rows (owner 27 Oct).
  let best: SearchResponse = await runSearch(input);
  const rows = (r: SearchResponse) => (r.results || []).length;
  if (rows(best) > 0) return best;
  const hardStop = started + Math.max(coldBudgetMs, 400);
  while (Date.now() < hardStop) {
    await new Promise((r) => setTimeout(r, 200));
    // Never let a follow-up attempt push the response PAST the caller's ceiling: each retry
    // gets only the budget that is actually left (owner 27 Oct, "1 second ke andar").
    const left = hardStop - Date.now();
    if (left < 200) break;
    let next: SearchResponse;
    try { next = await runSearch({ ...input, coldDeadlineMs: Math.max(200, left - 120) }); } catch { break; }
    if (rows(next) > rows(best)) best = next;
    if (rows(next) > 0) return next;
  }
  return best;
}

/**
 * Final product gate for an e-commerce ANSWER (owner 28 Oct). runSearch has several
 * return paths — the warm cache replay, the progressive catalogue answer, the
 * still-acquiring marker and the full pipeline — and only the last one runs the
 * assembler. Gating inside the assembler therefore missed the FAST path that most
 * users actually get ("iphone 18" answered with 148 catalogue rows including a
 * Rs.6,999 "CG MOBILE iPhone 18 Pro" knock-off and no colour collapse). This wrapper
 * applies the same identity gate to whatever the pipeline decided to return, so every
 * path answers with the same product family.
 */
function gateEcommerceResponse(
  input: SearchInput,
  response: SearchResponse,
  parsedVertical?: string,
): SearchResponse {
  if (!response || !Array.isArray(response.results) || response.results.length === 0) return response;
  const vertical = String(parsedVertical || response.query?.vertical || input.vertical || '');
  const query = String(input.query || '').trim();
  if (vertical !== 'ecommerce' || query.length < 2) return response;
  const priceOf = (o: any) => Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? o.prices?.listPrice ?? 0) || 0;
  // Department browse (owner 29 Oct): a tapped tab is a category, so the answer is judged
  // by category, never by the product-identity gate that turned "Gaming & PS5" into "must
  // contain the number 5" and left one lonely Reliance card.
  const dept = getEcomDepartment((input as any).browseDepartmentId) || resolveEcomDepartment(query);
  if (dept) {
    const kept = filterRowsForDepartment(response.results as any[], dept);
    if (kept.length !== response.results.length) {
      log.info('Search', 'Department browse filter (final)', {
        department: dept.label, before: response.results.length, kept: kept.length,
      });
    }
    response.results = backfillRowImages(kept as any[]) as any;
    response.results = collapseSellerVariants(response.results as any[], priceOf) as any;
    return response;
  }
  const gated = gateFeedProductRows(response.results as any[], query, priceOf);
  if (!gated.dropped.length) {
    response.results = backfillRowImages(response.results as any[]) as any;
    response.results = collapseSellerVariants(response.results as any[], priceOf) as any;
    return response;
  }
  log.info('Search', 'Withheld off-product e-commerce rows', {
    query: query.slice(0, 60),
    dropped: gated.dropped.length,
    reasons: gated.dropped.reduce((acc: Record<string, number>, d) => { acc[d.reason] = (acc[d.reason] || 0) + 1; return acc; }, {}),
    sample: gated.dropped.slice(0, 3).map((d: any) => String((d.row as any)?.title || '').slice(0, 50)),
    kept: gated.kept.length,
    path: String(response.state?.servedFrom || ''),
  });
  response.results = backfillRowImages(gated.kept as any[]) as any;
  response.results = collapseSellerVariants(response.results as any[], priceOf) as any;
  return response;
}

export async function runSearch(input: SearchInput): Promise<SearchResponse> {
  return gateEcommerceResponse(input, await runSearchPipeline(input));
}

export async function runSearchPolled(input: SearchInput, deadlineMs = 15_000): Promise<SearchResponse> {
  const deadline = Date.now() + deadlineMs;
  let best = await runSearch(input);
  while (Date.now() < deadline) {
    const latestPending = (best.state && best.state.pendingRefresh) === true;
    if (!latestPending) break;
    await new Promise((r) => setTimeout(r, 1_500));
    let next: SearchResponse;
    try { next = await runSearch(input); } catch { break; }
    // keep the fullest snapshot; a poll can never see fewer rows than the pipeline already produced
    if ((next.results || []).length > (best.results || []).length) best = next;
    if (next.state && next.state.pendingRefresh !== true) { if ((next.results || []).length > 0) best = next; break; }
  }
  return best;
}

async function runSearchPipeline(input: SearchInput): Promise<SearchResponse> {
  const totalStart = Date.now();

  // 1. QUERY UNDERSTANDING (deterministic core + optional AI assist)
  let parsed: ParsedQuery = understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng,
  });
  if (input.vertical) parsed.vertical = input.vertical as any;
  // Explicit PUDO labels (cab, owner 25 Oct): the app's granular picker sends
  // from/to directly; the cab worker prefers them over regex route extraction.
  if (input.from?.trim() && input.to?.trim()) parsed.pudo = { from: input.from.trim().slice(0, 120), to: input.to.trim().slice(0, 120) };
  if (input.travelDates?.depart) parsed.travelDates = { ...parsed.travelDates, depart: input.travelDates.depart, ...(input.travelDates.return ? { return: input.travelDates.return } : {}) };
  if (input.guests) parsed.parties = { ...parsed.parties, guests: input.guests };
  if (input.locality) parsed.location = { ...parsed.location, locality: input.locality };
  if (parsed.verticalConfidence < 0.6 || !parsed.vertical) {
    parsed = await aiAssistedUnderstanding(parsed);
  }
  const vertical = parsed.vertical || 'ecommerce'; // default browse vertical
  parsed.vertical = vertical;

  // DEPARTMENT BROWSE (owner 29 Oct: "tab pr click kr ke smart watch ya kuch v karo, pehle
  // to results nahi aata, phir jab aata hai tab sirf reliance ka bina image wala aa jata
  // hai. results har seller ka aana chahiye."). A tapped department label is a CATEGORY,
  // not a product: "Gaming & PS5" was read as a model number ("5"), "Audio & ANC" was
  // read as an accessory query, and a browse label never matches one product family, so
  // whichever single source answered fastest became the whole page. Resolve the label,
  // ask the marketplaces the term they actually answer ("mobile phone", not "Smartphones"),
  // and let the department filter - not the product-identity gate - judge the rows.
  const browseDept = vertical === 'ecommerce' ? resolveEcomDepartment(String(input.query || '')) : null;
  if (browseDept) {
    input = { ...input, query: browseDept.acquisition } as SearchInput;
    (input as any).browseDepartmentId = browseDept.id;
    parsed = understandQuery(input.query, { pincode: input.pincode, city: input.city, lat: input.lat, lng: input.lng });
    if (input.vertical) parsed.vertical = input.vertical as any;
    parsed.vertical = vertical;
  }

  const state: SearchStateFlags = {
    servedFrom: 'unavailable',
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
    reusedCatalogue: false,
    triggeredRefresh: false,
  };

  // 2. CACHE L1/L2 — full search-response cache keyed by all offer-affecting dimensions (Section 8)
  const cacheKey = buildCacheKey({
    // CACHE REVISION: a cached SearchResponse is replayed verbatim, so it bypasses the
    // pipeline's filters entirely. Bumping this retires snapshots built by older logic
    // (v2 = the e-commerce product gate + colour-variant collapse of 28 Oct, which would
    // otherwise keep serving phone covers out of the cache until each TTL expired).
    // rev 3 (29 Oct): bus schedule repair — a cached answer built before it still holds
    // rows with an empty timing gap, and a cached SearchResponse is replayed verbatim.
    rev: 3,
    vertical,
    q: input.query,
    pin: input.pincode,
    city: input.city,
    dates: parsed.travelDates?.depart,
    pax: parsed.parties?.passengers || parsed.parties?.guests,
    cfg: parsed.configuration ? JSON.stringify(parsed.configuration) : '',
  });

  const { ttlSec, staleSec } = searchCacheTtl(vertical);
  const cachedSearch = await cacheGet<SearchResponse>(cacheKey);
  // OWNER 27 Oct ("product naam daalo to kuch nahi aata"): the killer bug. A
  // 'still acquiring' marker and a transient zero-result snapshot were cached and then
  // replayed as the ANSWER (45s for empties, 6s for the marker) while a perfectly good
  // live pipeline was still running in the background. The product page makes ONE call,
  // so the user got an empty page even though Myntra/Flipkart/Ajio had rows 1s later.
  // A cached snapshot with no rows (or one that merely says "still acquiring") is NOT an
  // answer: evict it and fall through to the live/join path instead.
  const cachedValue = cachedSearch.value as SearchResponse | null;
  if (cachedValue && (((cachedValue.results || []).length === 0) || cachedValue.state?.pendingRefresh === true)) {
    cacheDel(cacheKey);
    log.info('Search', 'Evicted empty/still-acquiring cache entry, going live', { key: cacheKey, rows: (cachedValue.results || []).length });
  } else if (cachedValue) {
    const v = cachedValue as SearchResponse;
    // Honesty rule (Section 9): a replayed live result is CACHED_VERIFIED, never LIVE_VERIFIED.
    for (const o of v.results as any[]) {
      if (o.freshnessStatus === 'LIVE_VERIFIED') o.freshnessStatus = 'CACHED_VERIFIED';
      if (o.provenance) o.provenance.replayedFromCache = true;
    }
    v.state.servedFrom = 'cache';
    v.state.reusedCache = true;
    v.latencyMs = Date.now() - totalStart;
    v.totalSearchLatencyMs = v.latencyMs;
    // Stale-while-revalidate: serve instantly, refresh prices in the background (once per key).
    if (!cachedSearch.fresh) {
      revalidateInBackground(cacheKey, ttlSec, () => runLivePipeline(input, parsed));
    }
    return v;
  }

  // PROGRESSIVE COLD-START: same query already acquiring? Serve catalogue rows
  // honestly with pendingRefresh so clients keep polling instead of spawning work.
  const running = inflightPipelines.get(cacheKey);
  if (running) {
    // PROGRESSIVE POLL (owner 22 Oct, 'sab verticals slow'): a re-poll must NEVER
    // block on the full pipeline (that was a 10-30s hang per poll on slow
    // verticals). Wait at most 600ms for the pipeline to finish; otherwise serve
    // the newest live partial snapshot first (rows grow as sources land), then
    // fresh catalogue rows. Each poll is fast AND shows more than the last one.
    type R = { kind: 'full'; r: SearchResponse } | null;
    const early = await Promise.race([
      running.then((r): R => ({ kind: 'full', r }), (): R => null),
      new Promise<R>((res) => setTimeout(() => res(null), 600)),
    ]);
    if (early && early.kind === 'full') return early.r;
    const memo = inflightPartials.get(cacheKey);
    if (memo && memo.snap.results.length > 0) {
      if (!memo.response) {
        const ctx = await buildLiveCtx(parsed, input);
        const partial = await finalizeLive(Date.now(), input, parsed, ctx, memo.snap, false);
        if (partial.results.length > 0) {
          partial.state.pendingRefresh = true;
          memo.response = partial;
        }
      }
      if (memo.response) return memo.response;
    }
    // OWNER 28 Oct ('results kabhi aate hain kabhi nahi'): this branch called the floor with
    // its DEFAULT one-hour window while a pipeline was in flight, so a poll that arrived between
    // cache expiry and acquisition got ZERO rows ('servedFrom: unavailable') even though 267
    // hotel rows were sitting in MySQL. Same windows as the real floor now.
    const w = floorWindows(vertical);
    const offers = await freshCatalogueOffers(vertical, input, parsed, w.strict, w.fallback);
    if (offers.length >= 1) return await progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    // Owner 23 Oct: 'this caller waits' hung polls 30-40s on ecom cold searches —
    // the app's poll timer then died on its HTTP timeout and results never painted.
    // Serve the honest still-acquiring marker (pendingRefresh keeps the app polling;
    // rows land via the partial memo above as sources settle).
    return await stillAcquiringResponse(parsed, totalStart);
  }
  // Speed (27 Oct): the honest catalogue floor is looked up ONCE, in parallel with the
  // race below, so the cold answer never pays an extra DB round-trip after the timer.
  const windows = floorWindows(vertical);
  const floorPromise = freshCatalogueOffers(
    vertical, input, parsed, windows.strict, windows.fallback,
  ).catch(() => [] as NormalizedOffer[]);
  // Cold but catalogue has fresh rows: return them instantly, acquire live in background.
  {
    const offers = await floorPromise;
    if (offers.length >= 1) {
      const pipeline = runLivePipeline(input, parsed)
        .then((response) => {
          const { ttlSec: t, staleSec: st } = searchCacheTtl(vertical);
          // Empty live result: negative-cache only briefly. Fix 1 evicts it on read anyway,
          // so a source flake costs the user one extra acquisition, never an empty page.
          if (response.results.length === 0) cachePut(cacheKey, response, 12, 12);
          else { const bs = busSelfHealTtl(vertical, response, t, st); const bt = thinResultTtl(response, bs.ttlSec, bs.staleSec); cachePut(cacheKey, response, bt.ttlSec, bt.staleSec); }
          return response;
        })
        .finally(() => { inflightPipelines.delete(cacheKey); });
      inflightPipelines.set(cacheKey, pipeline);
      pipeline.catch(() => {}); // never crash the caller on a background failure
      return await progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    }
  }

  // FIRST-PAINT COLD PATH (owner 22 Oct, 'any vertical's results within 2-3s'):
  // a fully cold query no longer blocks on the slowest source. The FULL live
  // pipeline keeps acquiring and caches the complete set (as before); we race it
  // against a 2.2s first-paint deadline. If at least one source has already
  // returned real rows by then, the partial snapshot is finalized and served
  // with pendingRefresh so clients re-poll and pick up the completed response.
  // Nothing is invented: every row is a live acquisition, just from the sources
  // that finished so far; slower sources land seconds later via the client top-up.
  // If nothing real has arrived by the deadline we keep waiting for the full
  // pipeline — an honest wait, never a fabricated instant answer.
  // OWNER 27 Oct ("1 second ke andar results"): when the caller states a first-paint
  // ceiling, EVERY stage honours it — the first race included, not just the late deadline.
  // Leaving this at 2.2s let a cold product search take 2.4s even though the route asked
  // for 900ms. 150ms is reserved for the catalogue floor lookup that follows the race.
  const reqDeadlineMs = Math.max(250, Number((input as any).coldDeadlineMs) || 0);
  // Owner rule (27 Oct): the 3s promise is a single budget (latencyBudget.ts), so the
  // no-caller-deadline path is bounded by it too instead of its own 2.2s literal.
  const FIRST_PAINT_MS = reqDeadlineMs
    ? Math.max(250, reqDeadlineMs - 150)
    : (Number(process.env.T1S_FIRST_PAINT_MS) || firstPaintMs());
  const partialRef: { current: AcquisitionOutcome | null } = { current: null };
  // FIRST-LIVE-ROW signal (owner 22 Oct, 'sab verticals slow'): slow verticals
  // (hotels 5-15s per source) never had a row inside a fixed 2.2s window, so the
  // first paint degenerated to waiting for the FULL pipeline (30s spinners on a
  // first-ever hotel city). Now the first real row is a RACE LEG: the moment any
  // source settles with offers we paint immediately instead of idling to a timer.
  let firstRowResolve: ((snap: AcquisitionOutcome) => void) | null = null;
  const firstRow = new Promise<RaceOutcome>((resolve) => {
    firstRowResolve = (snap) => resolve({ kind: 'partial', snap });
  });
  const full = runLivePipeline(input, parsed, {
    onPartial: (snapshot) => {
      if (snapshot.results.length > 0) {
        partialRef.current = snapshot;
        inflightPartials.set(cacheKey, { snap: snapshot, response: null });
        if (firstRowResolve) { const r = firstRowResolve; firstRowResolve = null; r(snapshot); }
      }
    },
  })
    .then((response) => {
      // Cache-poisoning guard: a transient zero-result search (worker timeouts, edge-gate
      // sampling on a cold IP) must NOT be replayed for the normal fresh/stale window —
      // that is how users saw "only 2 flights" or empty feeds for 15 minutes. Empty
      // responses are cached briefly (45s) so the very next search re-acquires live,
      // while per-source rate limits still bound the retry pressure.
      if (response.results.length === 0) {
        cachePut(cacheKey, response, 12, 12);
      } else {
        const bs = busSelfHealTtl(vertical, response, ttlSec, staleSec);
        const bt = thinResultTtl(response, bs.ttlSec, bs.staleSec);
        cachePut(cacheKey, response, bt.ttlSec, bt.staleSec);
      }
      return response;
    })
    .finally(() => { inflightPipelines.delete(cacheKey); inflightPartials.delete(cacheKey); });
  inflightPipelines.set(cacheKey, full);
  full.catch(() => {}); // background pipeline failure never crashes this caller
  // The full pipeline persists every offer; the partial path must not double-write.
  const servePartial = async (): Promise<SearchResponse | null> => {
    const snapshot = partialRef.current;
    if (!snapshot || snapshot.results.length === 0) return null;
    const ctx = await buildLiveCtx(parsed, input);
    const partial = await finalizeLive(Date.now(), input, parsed, ctx, snapshot, false);
    if (partial.results.length === 0) return null;
    partial.state.pendingRefresh = true;
    return partial;
  };
  type RaceOutcome = { kind: 'full'; r: SearchResponse } | { kind: 'partial'; snap: AcquisitionOutcome } | { kind: 'timer' };
  const early: RaceOutcome = await Promise.race([
    full.then((r): RaceOutcome => ({ kind: 'full', r })),
    firstRow,
    new Promise<RaceOutcome>((resolve) => { setTimeout(() => resolve({ kind: 'timer' }), FIRST_PAINT_MS); }),
  ]);
  if (early.kind === 'full') return early.r;
  if (early.kind === 'partial') {
    const p = await servePartial();
    if (p) return p; // a source settled fast: paint NOW, top up in the background
  }
  // FIRST-PAINT FLOOR (owner 22 Oct, 'kaise v fix kro'): the deadline hit without
  // a live row — serve honest, relevance-gated CATALOGUE rows instead of hanging
  // on a spinner while the live pipeline finishes behind pendingRefresh. Travel
  // prices go stale fast, so they borrow only up to 60 min; product/finance
  // offers change slowly and borrow up to 24h. Every row is CACHED_VERIFIED
  // (replayedFromCache), nothing is invented; the top-up replaces them with
  // live prices seconds later.
  const floorOffers = await floorPromise;
  if (floorOffers.length > 0) {
    return await progressiveCatalogueResponse(vertical, parsed, floorOffers, totalStart, true);
  }
  // Nothing to borrow either: no fixed second timer — the moment the FIRST real
  // live row lands (or the full pipeline completes) we return. A cold hotel city
  // paints when its first source settles instead of after the whole pipeline.
  type ColdOutcome = { kind: 'full'; r: SearchResponse } | { kind: 'partial'; snap: AcquisitionOutcome } | { kind: 'deadline' };
  // HARD 3.2s deadline (owner 23 Oct, '3 second tho 30 sec kyun'): nothing real has
  // arrived by now AND the catalogue had nothing honest to borrow. Waiting for the
  // first live row unbounded meant 30-40s hangs (all sources slow/gated at once).
  // At the deadline we serve whatever partial rows exist; if none, the honest
  // pendingRefresh marker — the app's 2s polls then stream rows in progressively.
  // Deadline is measured from the START of the search (not from after the floor
  // lookup) so the whole cold path answers in ~3s, matching the app loader countdown.
  const COLD_DEADLINE_MS = Math.max(300, Number(input.coldDeadlineMs) || Number(process.env.T1S_COLD_DEADLINE_MS) || resultDeadlineMs());
  const deadlineRemaining = Math.max(0, COLD_DEADLINE_MS - (Date.now() - totalStart));
  const next: ColdOutcome = await Promise.race([
    full.then((r): ColdOutcome => ({ kind: 'full', r })),
    firstRow as Promise<ColdOutcome>,
    new Promise<ColdOutcome>((resolve) => { setTimeout(() => resolve({ kind: 'deadline' }), deadlineRemaining); }),
  ]);
  if (next.kind === 'full') return next.r;
  const p2 = await servePartial();
  if (p2) return p2;
  // No live row by the deadline: return the honest marker instead of a 30s hang.
  // The full pipeline keeps acquiring and caches the completed set (zero-result
  // guard applies); the client's next polls pick it up.
  const marker = await stillAcquiringResponse(parsed, totalStart);
  // OWNER 27 Oct: do NOT cache the marker. Caching it made the next request take the
  // cache branch (returning the empty marker) instead of joining the pipeline that is
  // still fetching — the exact reason results never appeared.
  return marker;
}

/** Shared acquisition context (state flags + catalogue supplements + sources). */
interface LiveCtx {
  state: SearchStateFlags;
  vertical: string;
  enabledSources: SourceConfig[];
  catalogueOffers: NormalizedOffer[];
  eligibleCount: number;
  hasEligibleFresh: boolean;
}

async function buildLiveCtx(parsedIn: ParsedQuery, input: SearchInput): Promise<LiveCtx> {
  const parsed = parsedIn;
  const vertical = parsed.vertical || 'ecommerce';
  parsed.vertical = vertical;

  const state: SearchStateFlags = {
    servedFrom: 'unavailable',
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
    reusedCatalogue: false,
    triggeredRefresh: false,
  };

  // 3. L3 CATALOGUE — eligible fresh, verified results returned first (Section 6)
  const catalogueRows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  const eligible = catalogueRows.filter((r) => {
    const ageSec = (now - new Date(r.fetched_at).getTime()) / 1000;
    return ageSec < 3600 && r.validation_status !== 'INVALID';
  });
  const catalogueOffers = (String(vertical) === 'flights'
    // Cold-start paint (owner 28 Oct): enrich the catalogue floor as well, so the
    // very first cards already show timings we learned earlier for that flight.
    ? enrichFlightSchedules(eligible.map((r) => rowToOffer(r, false)) as any)
    : eligible.map((r) => rowToOffer(r, false))) as NormalizedOffer[];

  // 4. INCREMENTAL TARGETED REFRESH — only if the catalogue is thin or aging (Section 7)
  const hasEligibleFresh = catalogueOffers.length > 0;
  const enabledSources = selectSources(parsed);
  state.reusedCatalogue = hasEligibleFresh;
  state.triggeredRefresh = !hasEligibleFresh || eligible.length < 5;

  return { state, vertical, enabledSources, catalogueOffers, eligibleCount: eligible.length, hasEligibleFresh };
}

/** Steps 6-11 of the pipeline: parse/normalize acquired results, combine with the
 *  catalogue, run the vertical engine, attach deep links, rank, build the response.
 *  Shared by the FULL pipeline and the FIRST-PAINT partial path (persist=false —
 *  the full pipeline that is still running performs the canonical DB writes). */
async function finalizeLive(
  totalStart: number,
  input: SearchInput,
  parsed: ParsedQuery,
  ctx: LiveCtx,
  outcome: AcquisitionOutcome,
  persist = true,
): Promise<SearchResponse> {
  const { state, vertical, enabledSources, catalogueOffers, hasEligibleFresh } = ctx;
  let liveOffers: NormalizedOffer[] = [];
  if (enabledSources.length > 0) {
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));

    // 6. PARSING → NORMALIZATION → MATCHING → PRICING → VALIDATION → FRESHNESS → EVIDENCE
    liveOffers = await processAdapterResults(outcome.results, parsed, persist);
    // LAST PRICE MEMORY: remember what each source last charged in this vertical so a
    // later blocked/empty search can show "Last: ₹X · when" instead of nothing.
    recordSourcePrices(String(vertical), String(input.query || ''), liveOffers as any);
    state.sourcesFailed = enrichFailedWithLastPrice(String(vertical), state.sourcesFailed) as any;
  } else {
    state.sourcesAttempted = [];
  }

  // 7. COMBINE: live results first (fresher), catalogue supplements without being relabeled
  // A catalogue replay of a listing that was just acquired live is strictly poorer (attributes are
  // not round-tripped), so it is dropped; catalogue rows only supplement listings live did not return.
  const liveIdentity = (o: NormalizedOffer) => `${o.vertical}|${o.title.toLowerCase()}|${o.seller.toLowerCase()}|${o.travel?.date || ''}|${o.travel?.route || ''}`;
  const liveKeys = new Set(liveOffers.map(liveIdentity));
  // Query-relevance gate (owner 22 Oct): the catalogue is vertical-wide, so a
  // fresh-but-unrelated batch (e.g. iPhones) must never supplement a watch/TV
  // query. Only rows sharing stemmed title tokens with the typed query replay.
  const supplementary = catalogueOffers.filter((o) => !liveKeys.has(liveIdentity(o)) && passesQueryRelevance(o, parsed));
  let combined = dedupeOffers([...liveOffers, ...supplementary]);

  // 7.1 FLIGHT SCHEDULE COMPLETION (owner 28 Oct: "flight mai bahut aisa section
  // hai jo 1st card show kar raha hai, pr hume second card chahiye"): a live row
  // teaches the SAME flight number's timings to catalogue/presence rows, so cards
  // render with flight no + dep/arr + duration + non-stop. Only OBSERVED timings
  // are copied (server/common/flightSchedule.ts) — a flight with no known schedule
  // keeps its bare row and the feed orders it last instead of inventing times.
  if (String(vertical) === 'flights') {
    combined = enrichFlightSchedules(combined as any) as any;
  }

  // 7.5 SELLER PRESENCE (owner 22 Oct): mandatory flight sellers that are
  // IP-gated / circuit-backed-off still appear at app level with their own
  // route-prefilled search URL (monetized via /api/out). Honest rows — no
  // price claimed, skipped automatically the moment the seller's live rows
  // return. Ephemeral: never persisted, circuits and probes untouched.
  if (String(vertical) === 'flights') {
    // EMPTY_RESPONSE failures are honest "seller answered, no rows" outcomes
    // (health.ts policy, 23 Oct) — same as a succeeded source for presence
    // purposes: e.g. Akasa's fare calendar returning zero bookable days on a
    // route it does not fly must NOT spawn a "feed unreachable" card.
    const honestEmpty = (outcome.failed || [])
      .filter((f: any) => f.failureClass === 'EMPTY_RESPONSE')
      .map((f: any) => f.sourceId)
      // Owner 24 Oct OTA expansion: route-agnostic aggregators (BudgetAir,
      // Gotogate, FlightsMojo, ...) treat EMPTY_RESPONSE as "recipe not yet
      // captured", not "no service on this route" — their honest presence
      // card must survive (handled via showOnEmpty inside the builder).
      .filter((id: string) => !PRESENCE_SHOW_ON_EMPTY_IDS.has(id));
    combined = [...combined, ...(await buildFlightSellerPresence(parsed, combined, [...(outcome.succeeded || []), ...honestEmpty]))];
  }

  // 7.9 MANUAL FINANCE INVENTORY (owner 27 Oct): entries the owner typed in the admin
  // panel (loans / credit cards / insurance / account) join the feed exactly like a
  // scraped row, so a gated source can never leave a vertical empty again.
  if (['loans', 'creditcards', 'insurance', 'account'].includes(String(vertical))) {
    try {
      const { liveManualFinanceOffers } = await import('../marketing/financeOffers');
      const manual = await liveManualFinanceOffers(String(vertical));
      if (manual.length) {
        const mapped = manual.map((m: any) => {
          let attrs: any = {};
          try { attrs = typeof m.attributes === 'string' ? JSON.parse(m.attributes) : (m.attributes || {}); } catch { attrs = {}; }
          return {
            id: `manual-${m.id}`,
            vertical: String(m.vertical),
            title: String(m.title || ''),
            seller: String(m.seller || m.title || ''),
            vendor: String(m.seller || m.title || ''),
            price: m.effective_price === null ? 0 : Number(m.effective_price),
            currency: 'INR',
            sellerUrl: attrs.affiliate_template
              // Owner 27 Oct: a manual finance entry can carry its OWN tracking
              // template — {url} is swapped for the real apply page so the user still
              // lands on the exact product, and the deeplink guard leaves it untouched.
              ? String(attrs.affiliate_template).replace(/\{url\}/g, encodeURIComponent(String(m.seller_url || '')))
              : String(m.seller_url || ''),
            imageUrl: attrs.image || undefined,
            attributes: { ...attrs, manual: 1 },
            freshnessStatus: 'LIVE_VERIFIED',
            validationStatus: 'VALID',
            sourceId: 'admin_manual',
            locationCity: m.location_city || null,
          } as any;
        });
        combined = [...mapped, ...combined];
      }
    } catch { /* manual inventory is optional — never break a vertical */ }
  }

  // 8. VERTICAL ENGINE — entity/query filtering + vertical-specific rules
  const engine = getVerticalEngine(vertical as any);
  combined = await engine.execute(combined, parsed);

  // 8.5 PRODUCT GATE (owner 28 Oct: "iphone 18 search krta hoon tho kabhi iphone 18
  // pro aata hai kabhi kuch aur, consistent result nahi aata"). E-commerce used to
  // trust every live row as "fetched by this query", but marketplaces answer a phone
  // query with its back covers and knock-offs, and price-sorting put those Rs.599
  // accessories above the real Rs.1,64,900 phone. Live AND catalogue rows now pass
  // the same identity gate, so the same query always resolves to the same product
  // family instead of whatever the fastest source happened to return.
  if (String(vertical) === 'ecommerce' && (String(input.query || '').trim().length >= 2)) {
    const priceOfRow = (o: any) => Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? o.prices?.listPrice ?? 0) || 0;
    const dept = getEcomDepartment((input as any).browseDepartmentId);
    if (dept) {
      const before = combined.length;
      combined = filterRowsForDepartment(combined as any[], dept) as any;
      log.info('Search', 'Department browse filter', {
        department: dept.label, asked: input.query, before, kept: combined.length,
      });
      combined = collapseSellerVariants(combined as any[], priceOfRow) as any;
    } else {
    const gated = gateFeedProductRows(combined as any[], String(input.query), priceOfRow);
    if (gated.dropped.length) {
      log.info('Search', 'Withheld off-product e-commerce rows', {
        query: String(input.query).slice(0, 60),
        dropped: gated.dropped.length,
        reasons: gated.dropped.reduce((acc: Record<string, number>, d) => { acc[d.reason] = (acc[d.reason] || 0) + 1; return acc; }, {}),
        sample: gated.dropped.slice(0, 3).map((d: any) => String((d.row as any)?.title || '').slice(0, 50)),
        kept: gated.kept.length,
      });
    }
    combined = gated.kept as any;
    // Same query, same shop, different colour -> one card (owner 28 Oct: "iphone 18"
    // answered with 130 cards, mostly the same listing in Burgundy/Black/Silver).
    combined = collapseSellerVariants(combined as any[], priceOfRow) as any;
    }
  }

  // 9. AFFILIATE DEEP LINKS (Section 15)
  combined = await attachAffiliateDeepLinks(combined);

  // 10. RANKING — comparable offers only, explainable scores
  // 22 Oct: product verticals (grocery/food) never get a merchant logo in place of a
      // product photo — strip stale favicons first, then let fresh photos through.
      const branded = withCardArt(stripCardLogoStandIns(stripMerchantLogoFallbacks(withBrandImages(combined))));
      const ranked = rankOffers(await withProductImages(await withMerchantLogos(await withLenderLogos(branded))), { userPincode: input.pincode, userCity: input.city });

  // State determination — honest, never overclaims
  if (ranked.length === 0) {
    state.servedFrom = 'unavailable';
    state.honestNotice = enabledSources.length === 0
      ? 'No data sources are enabled and verified for this vertical yet. Real results appear once a source is configured and passes validation — we never show invented prices.'
      : 'All configured sources were attempted but returned no verified offers for this query. Partial or cached data appears only when it passes freshness rules.';
  } else if (state.sourcesSucceeded.length > 0) {
    state.servedFrom = 'live';
  } else if (hasEligibleFresh) {
    state.servedFrom = 'catalogue';
  } else {
    state.servedFrom = 'partial';
  }

  const response: SearchResponse = {
    query: parsed,
    results: ranked,
    state,
    latencyMs: Date.now() - totalStart,
    totalSearchLatencyMs: Date.now() - totalStart,
  };

  // Persist search metrics (Section 20 observability)
  void recordSearchMetrics(input, parsed, response);

  return response;
}

/** Full acquisition pipeline (cache miss / background refresh path). onPartial
 *  (owner 22 Oct) receives a live snapshot of the sources settled so far — the
 *  search layer uses it to answer cold queries with a FIRST-PAINT partial response
 *  while this pipeline keeps acquiring and caches the complete result. */
async function runLivePipeline(input: SearchInput, parsedIn?: ParsedQuery, hooks?: { onPartial?: (snapshot: AcquisitionOutcome) => void }): Promise<SearchResponse> {
  const totalStart = Date.now();
  let parsed: ParsedQuery = parsedIn ?? understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng,
  });
  if (input.vertical) parsed.vertical = input.vertical as any;
  if (input.travelDates?.depart) parsed.travelDates = { ...parsed.travelDates, depart: input.travelDates.depart, ...(input.travelDates.return ? { return: input.travelDates.return } : {}) };
  if (input.guests) parsed.parties = { ...parsed.parties, guests: input.guests };
  if (input.locality) parsed.location = { ...parsed.location, locality: input.locality };
  if (!parsedIn && (parsed.verticalConfidence < 0.6 || !parsed.vertical)) {
    parsed = await aiAssistedUnderstanding(parsed);
  }

  const ctx = await buildLiveCtx(parsed, input);
  let outcome: AcquisitionOutcome = { results: [], attempted: [], succeeded: [], failed: [] };
  if (ctx.enabledSources.length > 0) {
    // 5. PARALLEL INDEPENDENT SOURCE ACQUISITION (Section 5)
    // 42s acquisition budget: Hostinger's nginx proxy returns 504 at ~55s. Cutting
    // acquisition at 42s leaves time for normalize/rank/respond + proxy headroom.
    const deadlineAt = Date.now() + (Number(process.env.LIVE_SEARCH_BUDGET_MS) || 42_000);
    // Owner 24 Oct OTA expansion: flights now carries 37 registered sources
    // (incl. 6 new OTA probes); the old cap of 20 silently cut the newest ones.
    // Other verticals have far fewer sources, so this cap only widens flights.
    outcome = await acquireParallel(parsed, { maxSources: 40, deadlineAt, onPartial: hooks?.onPartial });
  }
  return finalizeLive(totalStart, input, parsed, ctx, outcome);
}

/** Adapter results → validated, persisted, evidence-backed offers. */
/** persist=false is used by the FIRST-PAINT partial path (owner 22 Oct): the rows
 * are real live acquisitions, but the FULL pipeline (still running) persists them
 * once it completes — no double INSERTs, one canonical write per offer. */
async function processAdapterResults(results: AdapterResult[], parsed: ParsedQuery, persist = true): Promise<NormalizedOffer[]> {
  const { getSource } = await import('../sources/registry');
  const out: NormalizedOffer[] = [];

  let processed = 0;
  for (const result of results) {
    const source = getSource(result.sourceId);
    if (!source) continue;
    for (const raw of result.rawItems) {
      // HTTP-PRIORITY YIELD (owner self-healing rule, 21 Oct): parsing/normalizing
      // hundreds of offers is synchronous CPU; on a throttled shared core that starved
      // every request (the "server up but 504s" wedge). Every 50 items hand the event
      // loop a full macrotask turn so pending HTTP is served while a search runs.
      if (++processed % 50 === 0) await new Promise((r) => setImmediate(r));
      try {
        // NORMALIZE
        const offer = normalizeOffer(raw, source, (parsed.vertical || 'ecommerce') as any);
        // Merge parsed location WITHOUT clobbering source-provided fields: understandQuery
        // emits explicit `undefined` values which a plain spread would use to erase
        // the offer's real city — breaking pickup/destination validation downstream.
        const parsedLoc = Object.fromEntries(
          Object.entries(parsed.location || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        );
        offer.location = { ...offer.location, ...parsedLoc };

        // PRICING (fees + savings; only verified components subtract)
        const breakdown = computeEffectivePrice(offer.prices.fees, offer.prices.currency, { coupon: false, bank: false, cashback: false, giftCard: false });
        offer.prices.mandatoryTotal = breakdown.mandatoryTotal;
        offer.prices.effectivePrice = breakdown.effectivePrice;
        offer.prices.finalPayablePrice = breakdown.finalPayablePrice;
        offer.prices.listPrice = breakdown.listPrice;
        offer.prices.verifiedSavings = breakdown.verifiedSavings;

        // VALIDATION (Section 12 — per-vertical rules)
        const validation = validateOffer(offer, parsed);
        offer.validationStatus = validation.status;
        offer.confidence = validation.confidence;
        if (validation.status === 'INVALID') continue; // invalid offers are never surfaced

        // ENTITY / VARIANT / SELLER MATCHING (Section 10)
        const match = await resolveCanonicalEntity(offer);
        offer.canonicalEntityId = match.canonicalEntityId;
        offer.canonicalVariantId = match.canonicalVariantId;
        offer.matchState = match.matchState;
        offer.matchEvidence = match.matchEvidence;

        // FRESHNESS (Section 9) — genuinely live-acquired data, now validated
        const policy = source.freshnessPolicy;
        offer.freshnessStatus = computeFreshness(
          offer,
          { fetchedAt: raw.fetchedAt },
          policy,
          true,
          // Core-verified: no blocking failure and only non-blocking gaps (e.g. an unknown
          // delivery fee, which stays unknown — never invented). The price itself was just
          // acquired live, so it is LIVE_VERIFIED; the missing fee remains labelled unknown.
          validation.status === 'VALID' || validation.status === 'PARTIAL',
        );
        offer.provenance.validatedAt = new Date().toISOString();
        if (!isServable(offer.freshnessStatus)) continue;

        // PERSIST + PRICE HISTORY (Section 7)
        if (persist && source.permittedForRetention) {
          const rowId = await persistOffer(offer, raw, source);
          await recordPriceSnapshot(offer, rowId);
        }

        out.push(offer);
      } catch (e: any) {
        log.debug('Search', 'Offer processing rejected an item', { error: String(e).slice(0, 120) });
      }
    }
  }
  return out;
}

async function recordSearchMetrics(input: SearchInput, parsed: ParsedQuery, response: SearchResponse) {
  try {
    const { getStore } = await import('../common/db');
    await getStore().execute(
      `INSERT INTO searches (raw_query, vertical, detected_vertical, pincode, city, served_from, results_count, latency_ms, first_result_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.query.slice(0, 500), input.vertical || null, parsed.vertical, input.pincode || null,
        input.city || null, response.state.servedFrom, response.results.length, response.latencyMs, response.latencyMs],
    );
  } catch { /* observability is best-effort */ }
}
