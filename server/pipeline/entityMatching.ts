/**
 * Entity, Variant and Seller Matching (Section 10).
 * Hierarchy: CanonicalEntity → Variant → Vendor → Seller → Location → Offer.
 * Offers are only compared as identical products when confidently matched (identifiers
 * or deterministic attribute equality). Titles alone never merge two entities.
 */
import type { MatchState, NormalizedOffer, ParsedQuery, VerticalId } from '../types';
import { getStore } from '../common/db';
import { notifyWriteDenied } from '../catalogue/prune';
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
/** In-process canonical-entity cache, per vertical.
 *
 * OWNER 17 Nov (runtime log: 100 x "Entity resolution store failure: Queue limit reached." and every prune
 * task skipped for the same reason): this ran a 500-row SELECT for EVERY offer of every search - a 600-row
 * hotel search alone queued 600 selects plus 600 price-snapshot writes on a 10-connection pool with a 25
 * deep queue, so the queue overflowed and the background prunes were dropped with it. The entity table for a
 * vertical barely changes inside a search, so the list is now read once per vertical per TTL and kept in
 * memory; newly created entities are pushed into it immediately, so a second offer of the same title still
 * matches the row it just made. This removes ~150-600 round-trips per search without changing any verdict.
 */
const ENTITY_CACHE_MS = Number(process.env.T1S_ENTITY_CACHE_MS || 10 * 60_000);
const ENTITY_CACHE_MAX = 40;
type EntityRow = { id: number; name: string; brand: string | null };
const entityCache = new Map<string, { at: number; rows: EntityRow[] }>();

async function loadEntityRows(store: ReturnType<typeof getStore>, vertical: string): Promise<EntityRow[]> {
  const hit = entityCache.get(vertical);
  if (hit && Date.now() - hit.at < ENTITY_CACHE_MS) return hit.rows;
  const rows = (await store.query<any>(
    'SELECT id, name, brand FROM canonical_entities WHERE vertical = ? ORDER BY id DESC LIMIT 500',
    [vertical],
  )) as EntityRow[];
  entityCache.set(vertical, { at: Date.now(), rows });
  if (entityCache.size > ENTITY_CACHE_MAX) {
    const oldest = entityCache.keys().next().value;
    if (oldest !== undefined) entityCache.delete(oldest);
  }
  return rows;
}

/** Pool-pressure retry: a saturated queue is a "come back in 40ms" answer, not a lost match. */
async function withQueueRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      const msg = String(e?.message || e);
      if (!/Queue limit reached|ER_CON_COUNT_ERROR|Too many connections|ECONNRESET|ETIMEDOUT|PROTOCOL_CONNECTION_LOST/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 40 * (i + 1) + Math.floor(Math.random() * 40)));
    }
  }
  throw last;
}

/** One warning a minute instead of one per offer (the 17 Nov log carried 100 identical lines). */
let lastStoreWarnAt = 0;
function warnStoreOnce(err: string) {
  if (Date.now() - lastStoreWarnAt < 60_000) return;
  lastStoreWarnAt = Date.now();
  log.warn('Matching', 'Entity resolution store failure', { error: err.slice(0, 120) });
}

export async function resolveCanonicalEntity(offer: NormalizedOffer): Promise<MatchDecision> {
  const store = getStore();
  try {
    const rows = await withQueueRetry(() => loadEntityRows(store, offer.vertical));
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
    // Not confidently matched: create a NEW canonical entity (never merge on look-alike titles).
    // Parallel offers of the same title race here: ON DUPLICATE + LAST_INSERT_ID makes the loser
    // of the race reuse the winner's row id instead of throwing 'Duplicate entry uq_entity'.
    const res = await withQueueRetry(() => store.execute(
      'INSERT INTO canonical_entities (vertical, name, brand) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      [offer.vertical, offer.title.slice(0, 500), offer.brand || null],
    ));
    // Keep the cache honest for the rest of this search: later offers of the same title must see this row.
    const cached = entityCache.get(offer.vertical);
    if (cached && res?.insertId) {
      cached.rows.unshift({ id: Number(res.insertId), name: offer.title.slice(0, 500), brand: offer.brand || null });
      if (cached.rows.length > 500) cached.rows.length = 500;
    }
    return {
      canonicalEntityId: res.insertId,
      canonicalVariantId: null,
      matchState: 'MATCHED',
      matchEvidence: 'new canonical entity created from first observed offer',
    };
  } catch (e: any) {
    notifyWriteDenied(String(e));
    warnStoreOnce(String(e));
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
