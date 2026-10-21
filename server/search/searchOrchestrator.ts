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
import type { AdapterResult, NormalizedOffer, ParsedQuery, SearchResponse, SearchStateFlags } from '../types';
import { recordSourcePrices, enrichFailedWithLastPrice } from '../common/lastPrice';
import { buildCacheKey, cacheGet, cachePut, revalidateInBackground } from '../common/cache';
import { log } from '../common/logger';
import { aiAssistedUnderstanding, understandQuery } from '../query/queryUnderstanding';
import { selectSources } from '../sources/registry';
import { acquireParallel } from '../sources/orchestrator';
import { dedupeOffers, normalizeOffer } from '../pipeline/normalization';
import { validateOffer } from '../pipeline/validation';
import { computeEffectivePrice } from '../pipeline/pricing';
import { computeFreshness, isServable } from '../pipeline/freshness';
import { withBrandImages, withLenderLogos, withMerchantLogos } from '../pipeline/brandImage';
import { withProductImages } from '../pipeline/productImages';
import { resolveCanonicalEntity } from '../pipeline/entityMatching';
import { rankOffers } from '../pipeline/ranking';
import { getVerticalEngine } from '../verticals/verticalEngine';
import { findCatalogueOffers, persistOffer, recordPriceSnapshot, type CatalogueRow } from '../catalogue/catalogueService';
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

function progressiveCatalogueResponse(
  vertical: string,
  inputQuery: ParsedQuery,
  offers: any[],
  start: number,
  pending: boolean
): SearchResponse {
  const anyOffers = offers as any[];
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

async function freshCatalogueOffers(vertical: string, input: SearchInput): Promise<any[]> {
  const rows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  return rows
    .filter((r) => (now - new Date(r.fetched_at).getTime()) / 1000 < 3600 && r.validation_status !== 'INVALID')
    .map((r) => rowToOffer(r, false));
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
    const offers = await freshCatalogueOffers(vertical, input);
    if (offers.length >= 4) return progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    return running; // nothing to show yet — this caller becomes the one that waits
  }
  // Cold but catalogue has fresh rows: return them instantly, acquire live in background.
  {
    const offers = await freshCatalogueOffers(vertical, input);
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
      return progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    }
  }

  const response = await runLivePipeline(input, parsed);
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
}

/** Full acquisition pipeline (cache miss / background refresh path). */
async function runLivePipeline(input: SearchInput, parsedIn?: ParsedQuery): Promise<SearchResponse> {
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

  let liveOffers: NormalizedOffer[] = [];
  if (enabledSources.length > 0) {
    // 5. PARALLEL INDEPENDENT SOURCE ACQUISITION (Section 5)
    // 42s acquisition budget: Hostinger's nginx proxy returns 504 at ~55s. Cutting
    // acquisition at 42s leaves time for normalize/rank/respond + proxy headroom.
    const deadlineAt = Date.now() + (Number(process.env.LIVE_SEARCH_BUDGET_MS) || 42_000);
    const outcome = await acquireParallel(parsed, { maxSources: 20, deadlineAt });
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));

    // 6. PARSING → NORMALIZATION → MATCHING → PRICING → VALIDATION → FRESHNESS → EVIDENCE
    liveOffers = await processAdapterResults(outcome.results, parsed);
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
  const supplementary = catalogueOffers.filter((o) => !liveKeys.has(liveIdentity(o)));
  let combined = dedupeOffers([...liveOffers, ...supplementary]);

  // 8. VERTICAL ENGINE — entity/query filtering + vertical-specific rules
  const engine = getVerticalEngine(vertical as any);
  combined = await engine.execute(combined, parsed);

  // 9. AFFILIATE DEEP LINKS (Section 15)
  combined = await attachAffiliateDeepLinks(combined);

  // 10. RANKING — comparable offers only, explainable scores
  const ranked = rankOffers(await withProductImages(await withMerchantLogos(await withLenderLogos(withBrandImages(combined)))), { userPincode: input.pincode, userCity: input.city });

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

/** Adapter results → validated, persisted, evidence-backed offers. */
async function processAdapterResults(results: AdapterResult[], parsed: ParsedQuery): Promise<NormalizedOffer[]> {
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
        if (source.permittedForRetention) {
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
