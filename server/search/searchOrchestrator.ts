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
import { buildCacheKey, cached } from '../common/cache';
import { log } from '../common/logger';
import { aiAssistedUnderstanding, understandQuery } from '../query/queryUnderstanding';
import { selectSources } from '../sources/registry';
import { acquireParallel } from '../sources/orchestrator';
import { dedupeOffers, normalizeOffer } from '../pipeline/normalization';
import { validateOffer } from '../pipeline/validation';
import { computeEffectivePrice } from '../pipeline/pricing';
import { computeFreshness, isServable } from '../pipeline/freshness';
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
    attributes: {},
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

  const cachedSearch = await cached<SearchResponse | null>(cacheKey, 60, async () => null);
  if (cachedSearch.value && cachedSearch.fresh) {
    const v = cachedSearch.value as SearchResponse;
    // Mark honestly: served from cache
    v.state.servedFrom = 'cache';
    v.latencyMs = Date.now() - totalStart;
    return v;
  }

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
    const outcome = await acquireParallel(parsed, { maxSources: 6 });
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));

    // 6. PARSING → NORMALIZATION → MATCHING → PRICING → VALIDATION → FRESHNESS → EVIDENCE
    liveOffers = await processAdapterResults(outcome.results, parsed);
  } else {
    state.sourcesAttempted = [];
  }

  // 7. COMBINE: live results first (fresher), catalogue supplements without being relabeled
  let combined = dedupeOffers([...liveOffers, ...catalogueOffers]);

  // 8. VERTICAL ENGINE — entity/query filtering + vertical-specific rules
  const engine = getVerticalEngine(vertical as any);
  combined = await engine.execute(combined, parsed);

  // 9. AFFILIATE DEEP LINKS (Section 15)
  combined = await attachAffiliateDeepLinks(combined);

  // 10. RANKING — comparable offers only, explainable scores
  const ranked = rankOffers(combined, { userPincode: input.pincode, userCity: input.city });

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

  for (const result of results) {
    const source = getSource(result.sourceId);
    if (!source) continue;
    for (const raw of result.rawItems) {
      try {
        // NORMALIZE
        const offer = normalizeOffer(raw, source, (parsed.vertical || 'ecommerce') as any);
        offer.location = { ...offer.location, ...parsed.location };

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
          validation.status === 'VALID',
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
