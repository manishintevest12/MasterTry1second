/**
 * FreshnessEngine + EvidenceManager (Section 9).
 * Separate tracked timestamps, explicit statuses, per-source/vertical/field TTL policy.
 * Cached data is never labeled LIVE_VERIFIED because it was returned during a new search.
 */
import { createHash } from 'crypto';
import type { FreshnessStatus, NormalizedOffer, RawSourceItem, SourceConfig, VerticalId } from '../types';

export interface FreshnessClock {
  sourceUpdatedAt?: string; // when the source says its data changed
  fetchedAt: string;
  validatedAt?: string;
  cacheWrittenAt?: string;
  expiresAt?: string;
  servedAt?: string;
}

const VERTICAL_DEFAULT_TTL: Record<VerticalId, { liveVerified: number; fresh: number; maxStale: number }> = {
  food: { liveVerified: 600, fresh: 1800, maxStale: 3600 },
  grocery: { liveVerified: 900, fresh: 3600, maxStale: 21600 },
  ecommerce: { liveVerified: 3600, fresh: 21600, maxStale: 172800 },
  flights: { liveVerified: 600, fresh: 1800, maxStale: 21600 },
  hotels: { liveVerified: 900, fresh: 3600, maxStale: 86400 },
  cab: { liveVerified: 300, fresh: 900, maxStale: 3600 },
  loans: { liveVerified: 86400, fresh: 86400, maxStale: 604800 },
  insurance: { liveVerified: 86400, fresh: 86400, maxStale: 604800 },
  movies: { liveVerified: 900, fresh: 3600, maxStale: 86400 },
  bus: { liveVerified: 600, fresh: 1800, maxStale: 86400 },
  coupons: { liveVerified: 3600, fresh: 21600, maxStale: 259200 },
  giftcards: { liveVerified: 3600, fresh: 21600, maxStale: 259200 },
  banking: { liveVerified: 21600, fresh: 86400, maxStale: 604800 },
};

export function freshnessPolicyFor(source: SourceConfig, vertical: VerticalId) {
  // Vertical default overridden by explicit per-source policy
  const v = VERTICAL_DEFAULT_TTL[vertical];
  return {
    liveVerifiedTtlSec: Math.min(source.freshnessPolicy.liveVerifiedTtlSec, v.liveVerified),
    freshTtlSec: Math.min(source.freshnessPolicy.freshTtlSec, v.fresh),
    maxStaleSec: Math.min(source.freshnessPolicy.maxStaleSec, v.maxStale),
  };
}

/**
 * Compute the freshness status of an offer, given whether the current search
 * genuinely re-verified it (isLiveAcquisition) vs. served from storage.
 */
export function computeFreshness(
  offer: NormalizedOffer,
  clock: FreshnessClock,
  policy: { liveVerifiedTtlSec: number; freshTtlSec: number; maxStaleSec: number },
  isLiveAcquisition: boolean,
  validated: boolean,
): FreshnessStatus {
  const now = Date.now();
  const fetched = new Date(clock.fetchedAt).getTime();
  const sourceUpdated = clock.sourceUpdatedAt ? new Date(clock.sourceUpdatedAt).getTime() : null;

  if (clock.expiresAt && new Date(clock.expiresAt).getTime() < now) return 'EXPIRED';
  if (sourceUpdated && sourceUpdated > fetched) return 'UNVERIFIED'; // source changed since fetch
  if (validated && isLiveAcquisition && (now - fetched) / 1000 <= policy.liveVerifiedTtlSec) return 'LIVE_VERIFIED';
  if ((now - fetched) / 1000 <= policy.freshTtlSec) return validated ? 'FRESH' : 'UNVERIFIED';
  if ((now - fetched) / 1000 <= policy.maxStaleSec) return validated ? 'AGING' : 'STALE';
  return validated ? 'STALE' : 'EXPIRED';
}

export function isServable(status: FreshnessStatus): boolean {
  return ['LIVE_VERIFIED', 'FRESH', 'CACHED_VERIFIED', 'AGING'].includes(status);
}

export function isComparable(status: FreshnessStatus): boolean {
  return ['LIVE_VERIFIED', 'FRESH', 'CACHED_VERIFIED'].includes(status);
}

// ---------------- EvidenceManager ----------------
export interface EvidenceRecord {
  offerId: string;
  sourceId: string;
  sourceMethod: string;
  sourceUrl?: string;
  sourceReference?: string;
  fetchedAt: string;
  extractedFields: string[];
  evidenceHash: string;
}

/** Hash binds the evidence to what the source actually returned (fingerprint of raw payload). */
export function buildEvidence(offer: NormalizedOffer, raw: RawSourceItem): EvidenceRecord {
  return {
    offerId: offer.id,
    sourceId: offer.provenance.sourceId,
    sourceMethod: offer.provenance.sourceMethod,
    sourceUrl: raw.evidence?.sourceUrl || offer.sellerUrl,
    sourceReference: raw.evidence?.sourceReference,
    fetchedAt: raw.fetchedAt,
    extractedFields: raw.evidence?.extractedFields || [],
    evidenceHash: raw.evidence?.rawFingerprint || createHash('sha256').update(raw.title).digest('hex'),
  };
}

/** The five integrity questions every offer must be able to answer (Section 9). */
export function evidenceAudit(offer: NormalizedOffer, evidence: EvidenceRecord | null) {
  return {
    origin: {
      sourceId: offer.provenance.sourceId,
      sourceMethod: offer.provenance.sourceMethod,
      sourceUrl: offer.provenance.sourceUrl,
      adapterVersion: offer.provenance.adapterVersion,
      parserVersion: offer.provenance.parserVersion,
    },
    fetchedAt: offer.provenance.fetchedAt,
    verifiedFields: evidence?.extractedFields || [],
    unverifiedFields: evidence ? missingCoreFields(offer, evidence.extractedFields) : coreFields(),
    whyAcceptedOrRejected: {
      validationStatus: offer.validationStatus,
      freshnessStatus: offer.freshnessStatus,
      matchState: offer.matchState,
      confidence: offer.confidence,
    },
    requiresRefreshAt: offer.expiresAt || null,
    evidenceHash: evidence?.evidenceHash || offer.provenance.evidenceHash || null,
  };
}

function coreFields(): string[] {
  return ['title', 'price', 'currency', 'seller', 'availability'];
}

function missingCoreFields(offer: NormalizedOffer, extracted: string[]): string[] {
  return coreFields().filter((f) => {
    if (extracted.includes(f)) return false;
    if (f === 'price') return offer.prices.mandatoryTotal === undefined;
    if (f === 'seller') return !offer.seller;
    return false;
  });
}
