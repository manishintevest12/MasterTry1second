/**
 * Entity, Variant and Seller Matching (Section 10).
 * Hierarchy: CanonicalEntity → Variant → Vendor → Seller → Location → Offer.
 * Offers are only compared as identical products when confidently matched (identifiers
 * or deterministic attribute equality). Titles alone never merge two entities.
 */
import type { MatchState, NormalizedOffer, ParsedQuery, VerticalId } from '../types';
import { getStore } from '../common/db';
import { log } from '../common/logger';

export interface MatchDecision {
  canonicalEntityId: number | null;
  canonicalVariantId: number | null;
  matchState: MatchState;
  matchEvidence: string;
}

/** Deterministic match strength between an offer and a stored canonical entity. */
export function matchScore(offer: NormalizedOffer, entity: { name: string; brand?: string | null; identifiers?: string }): number {
  let score = 0;
  const reasons: string[] = [];
  const offerIds = Object.values(offer.identifiers || {});
  const entityIds = entity.identifiers ? entity.identifiers.split(',').map((s) => s.trim()) : [];
  const idHit = offerIds.find((id) => entityIds.includes(id));
  if (idHit) { score += 0.6; reasons.push(`shared identifier ${idHit}`); }
  const titleMatch = normalizedTitle(offer.title) === normalizedTitle(entity.name);
  if (titleMatch) { score += 0.25; reasons.push('exact normalized title'); }
  else if (tokenOverlap(offer.title, entity.name) > 0.85) { score += 0.15; reasons.push('high token overlap'); }
  if (offer.brand && entity.brand && offer.brand.toLowerCase() === entity.brand.toLowerCase()) {
    score += 0.15; reasons.push('brand match');
  }
  log.debug('Matching', `score=${score.toFixed(2)} for ${offer.title.slice(0, 50)}`, { reasons });
  return score;
}

function normalizedTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizedTitle(a).split(' '));
  const tb = new Set(normalizedTitle(b).split(' '));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return ta.size === 0 ? 0 : inter / ta.size;
}

/**
 * Resolve (or lazily create) the canonical entity for an offer.
 * Creation is conservative: exact identifiers or very high deterministic score only.
 */
export async function resolveCanonicalEntity(offer: NormalizedOffer): Promise<MatchDecision> {
  const store = getStore();
  try {
    const rows = await store.query<any>(
      'SELECT id, name, brand FROM canonical_entities WHERE vertical = ? ORDER BY id DESC LIMIT 500',
      [offer.vertical],
    );
    let best: { id: number; score: number } | null = null;
    for (const row of rows) {
      const score = matchScore(offer, { name: row.name, brand: row.brand });
      if (score >= 0.6 && (!best || score > best.score)) best = { id: Number(row.id), score };
    }
    if (best && best.score >= 0.6) {
      return {
        canonicalEntityId: best.id,
        canonicalVariantId: null,
        matchState: best.score >= 0.75 ? 'MATCHED' : 'PROBABLE_MATCH',
        matchEvidence: `deterministic score ${best.score.toFixed(2)}`,
      };
    }
    // Not confidently matched: create a NEW canonical entity (never merge on look-alike titles)
    const res = await store.execute(
      'INSERT INTO canonical_entities (vertical, name, brand) VALUES (?, ?, ?)',
      [offer.vertical, offer.title.slice(0, 500), offer.brand || null],
    );
    return {
      canonicalEntityId: res.insertId,
      canonicalVariantId: null,
      matchState: 'MATCHED',
      matchEvidence: 'new canonical entity created from first observed offer',
    };
  } catch (e: any) {
    log.warn('Matching', 'Entity resolution store failure', { error: String(e).slice(0, 120) });
    return { canonicalEntityId: null, canonicalVariantId: null, matchState: 'REVIEW_REQUIRED', matchEvidence: 'store unavailable' };
  }
}

/** Deterministic validation of an AI-assisted candidate match (AI proposes, rules decide). */
export function validateAiCandidateMatch(offer: NormalizedOffer, candidateEntity: { name: string; brand?: string }): MatchState {
  const score = matchScore(offer, candidateEntity);
  return score >= 0.6 ? 'PROBABLE_MATCH' : 'NOT_MATCHED';
}

/** Query-side entity hint: gives the ranking engine the user's target entity name. */
export function queryEntityKey(query: ParsedQuery, vertical: VerticalId): string {
  return normalizedTitle(query.entityName || query.rawQuery).slice(0, 120) || vertical;
}
