/**
 * RankingEngine (Section 6): ranks comparable offers only.
 * Only offers of the SAME canonical entity (or confident match) are compared with
 * each other; freshness and validation weight the score. Unavailable offers never
 * rank as purchasable. Every rank decision is explainable via rankReasons.
 */
import type { FreshnessStatus, NormalizedOffer, SearchResultOffer } from '../types';
import { isComparable } from './freshness';

const FRESHNESS_WEIGHT: Record<FreshnessStatus, number> = {
  LIVE_VERIFIED: 1.0,
  FRESH: 0.85,
  CACHED_VERIFIED: 0.75,
  AGING: 0.5,
  STALE: 0.25,
  PARTIAL: 0.1,
  EXPIRED: 0,
  UNVERIFIED: 0.1,
  SOURCE_UNAVAILABLE: 0,
  INVALID: 0,
  UNKNOWN: 0.1,
};

export function rankOffers(
  offers: NormalizedOffer[],
  opts: { userPincode?: string; userCity?: string } = {},
): SearchResultOffer[] {
  const reasons: Map<string, string[]> = new Map();

  const scoreOf = (o: NormalizedOffer): number => {
    const rs: string[] = [];
    let score = 0;

    const fresh = FRESHNESS_WEIGHT[o.freshnessStatus] ?? 0;
    score += fresh * 30;
    rs.push(`freshness ${o.freshnessStatus} (+${(fresh * 30).toFixed(1)})`);

    score += o.confidence * 30;
    rs.push(`validation confidence ${o.confidence.toFixed(2)} (+${(o.confidence * 30).toFixed(1)})`);

    if (o.matchState === 'MATCHED') { score += 10; rs.push('entity MATCHED (+10)'); }
    else if (o.matchState === 'PROBABLE_MATCH') { score += 5; rs.push('entity PROBABLE_MATCH (+5)'); }
    else if (o.matchState === 'REVIEW_REQUIRED') { score -= 5; rs.push('entity REVIEW_REQUIRED (-5)'); }

    // Location proximity: same pincode > same city > elsewhere
    if (opts.userPincode && o.location?.pincode === opts.userPincode) { score += 8; rs.push('exact pincode match (+8)'); }
    else if (opts.userCity && o.location?.city?.toLowerCase() === opts.userCity.toLowerCase()) { score += 4; rs.push('same city (+4)'); }

    // Verified savings (absolute) — real money off, only verified components count
    if (o.prices.verifiedSavings && o.prices.verifiedSavings > 0 && o.prices.mandatoryTotal) {
      const pct = o.prices.verifiedSavings / o.prices.mandatoryTotal;
      score += Math.min(10, pct * 40);
      rs.push(`verified savings ${pct.toFixed(2)} (+${Math.min(10, pct * 40).toFixed(1)})`);
    }

    if (o.availability === 'out_of_stock') { score -= 40; rs.push('out of stock (-40, never ranked purchasable)'); }
    if (o.validationStatus === 'INVALID') { score -= 50; rs.push('INVALID validation (-50)'); }

    reasons.set(o.id, rs);
    return score;
  };

  const ranked = offers
    .filter((o) => o.validationStatus !== 'INVALID') // invalid offers never surface in results
    .map((o) => ({ o, score: scoreOf(o) }))
    .sort((a, b) => b.score - a.score);

  // Price ordering is applied WITHIN a canonical entity group only (Section 10):
  // we never claim different products are cheaper than each other.
  const byEntity = new Map<string, { o: NormalizedOffer; score: number }[]>();
  for (const entry of ranked) {
    const key = String(entry.o.canonicalEntityId || `unmatched:${entry.o.id}`);
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key)!.push(entry);
  }
  for (const group of byEntity.values()) {
    if (group.length > 1 && group.every((g) => g.o.prices.effectivePrice !== undefined)) {
      group.sort((a, b) => (a.o.prices.effectivePrice! - b.o.prices.effectivePrice!) || (b.score - a.score));
    }
  }

  const ordered = [...byEntity.values()].flat();

  return ordered.map(({ o }, i) => ({
    ...o,
    rank: i + 1,
    rankReasons: reasons.get(o.id) || [],
  }));
}

/** Are two offers comparable as the same product? (used by comparison views) */
export function areComparable(a: NormalizedOffer, b: NormalizedOffer): boolean {
  if (a.canonicalEntityId && b.canonicalEntityId) return a.canonicalEntityId === b.canonicalEntityId;
  if (a.matchState === 'MATCHED' && b.matchState === 'MATCHED') {
    const idA = a.identifiers.gtin || a.identifiers.sku;
    const idB = b.identifiers.gtin || b.identifiers.sku;
    if (idA && idB) return idA === idB;
  }
  return isComparable(a.freshnessStatus) && isComparable(b.freshnessStatus);
}
