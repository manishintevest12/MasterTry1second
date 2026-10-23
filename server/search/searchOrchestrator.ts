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
import { buildCacheKey, cacheGet, cachePut, revalidateInBackground } from '../common/cache';
import { log } from '../common/logger';
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
import { buildFlightSellerPresence } from './sellerPresence';
import { getVerticalEngine } from '../verticals/verticalEngine';
import { findCatalogueOffers, persistOffer, recordPriceSnapshot, type CatalogueRow } from '../catalogue/catalogueService';
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
  if (['flights', 'hotels', 'bus', 'cab', 'movies'].includes(vertical)) return { ttlSec: 300, staleSec: 900 };
  return { ttlSec: 900, staleSec: 2700 };
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
  const text = `${offer.title || ''} ${offer.subtitle || ''} ${offer.travel?.route || ''} ${String(attrs.route || '')} ${String(attrs.destination || '')}`.toLowerCase();
  const hits = (toks: string[]) => toks.some((t) => text.includes(t));
  if (!hits(dest)) return false;
  if (origin.length && !hits(origin)) return false;
  return true;
}

async function freshCatalogueOffers(vertical: string, input: SearchInput, parsed: ParsedQuery, maxAgeSec = 3600): Promise<any[]> {
  const rows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  let offers = rows
    .filter((r) => (now - new Date(r.fetched_at).getTime()) / 1000 < maxAgeSec && r.validation_status !== 'INVALID')
    .map((r) => rowToOffer(r, false));
  if (RELEVANCE_GATED_CATALOGUE.has(vertical)) {
    offers = offers.filter((o) => passesQueryRelevance(o, parsed));
  }
  // Route-aware floor (owner 23 Oct): bus/flights borrowed rows must name the
  // queried route, or the floor is skipped for that row — never show a
  // wrong-route bus/flight during the cold-start window.
  if (vertical === 'bus' || vertical === 'flights') {
    offers = offers.filter((o) => routeFloorMatches(parsed.rawQuery ?? input.query, o));
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

export async function runSearch(input: SearchInput): Promise<SearchResponse> {
  const totalStart = Date.now();

  // 1. QUERY UNDERSTANDING (deterministic core + optional AI assist)
  let parsed: ParsedQuery = understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng,
  });
  if (input.vertical) parsed.vertical = input.vertical as any;
  if (input.travelDates?.depart) parsed.travelDates = { ...parsed.travelDates, depart: input.travelDates.depart, ...(input.travelDates.return ? { return: input.travelDates.return } : {}) };
  if (input.guests) parsed.parties = { ...parsed.parties, guests: input.guests };
  if (input.locality) parsed.location = { ...parsed.location, locality: input.locality };
  if (parsed.verticalConfidence < 0.6 || !parsed.vertical) {
    parsed = await aiAssistedUnderstanding(parsed);
  }
  const vertical = parsed.vertical || 'ecommerce'; // default browse vertical
  parsed.vertical = vertical;

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
  if (cachedSearch.value) {
    const v = cachedSearch.value as SearchResponse;
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
    const offers = await freshCatalogueOffers(vertical, input, parsed);
    if (offers.length >= 4) return await progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    // Owner 23 Oct: 'this caller waits' hung polls 30-40s on ecom cold searches —
    // the app's poll timer then died on its HTTP timeout and results never painted.
    // Serve the honest still-acquiring marker (pendingRefresh keeps the app polling;
    // rows land via the partial memo above as sources settle).
    return await stillAcquiringResponse(parsed, totalStart);
  }
  // Cold but catalogue has fresh rows: return them instantly, acquire live in background.
  {
    const offers = await freshCatalogueOffers(vertical, input, parsed);
    if (offers.length >= 4) {
      const pipeline = runLivePipeline(input, parsed)
        .then((response) => {
          const { ttlSec: t, staleSec: st } = searchCacheTtl(vertical);
          if (response.results.length === 0) cachePut(cacheKey, response, 45, 45);
          else cachePut(cacheKey, response, t, st);
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
  const FIRST_PAINT_MS = Number(process.env.T1S_FIRST_PAINT_MS) || 2_200;
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
        cachePut(cacheKey, response, 45, 45);
      } else {
        cachePut(cacheKey, response, ttlSec, staleSec);
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
  const travelish = vertical === 'flights' || vertical === 'hotels' || vertical === 'bus' || vertical === 'cab';
  const floorOffers = await freshCatalogueOffers(vertical, input, parsed, travelish ? 3600 : 24 * 3600);
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
  const COLD_DEADLINE_MS = Number(process.env.T1S_COLD_DEADLINE_MS) || 3_200;
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
  cachePut(cacheKey, marker, 6, 6);
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
  const catalogueOffers = eligible.map((r) => rowToOffer(r, false));

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

  // 7.5 SELLER PRESENCE (owner 22 Oct): mandatory flight sellers that are
  // IP-gated / circuit-backed-off still appear at app level with their own
  // route-prefilled search URL (monetized via /api/out). Honest rows — no
  // price claimed, skipped automatically the moment the seller's live rows
  // return. Ephemeral: never persisted, circuits and probes untouched.
  if (String(vertical) === 'flights') {
    combined = [...combined, ...(await buildFlightSellerPresence(parsed, combined))];
  }

  // 8. VERTICAL ENGINE — entity/query filtering + vertical-specific rules
  const engine = getVerticalEngine(vertical as any);
  combined = await engine.execute(combined, parsed);

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
    outcome = await acquireParallel(parsed, { maxSources: 20, deadlineAt, onPartial: hooks?.onPartial });
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
