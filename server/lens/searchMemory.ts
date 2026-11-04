/**
 * ASSISTANT SEARCH MEMORY (owner 3 Nov: "ask try1second ai usme ye feature v add kro ki wo
 * yaad rkh ske results jiss se aage wo aur accurate results dein, self trained type").
 *
 * WHAT THIS IS, HONESTLY: a self-learning recall layer, not a model. Every search the
 * assistant runs leaves a compact record of what actually came back - which sellers answered,
 * how many rows landed, and the cheapest verified price per seller - keyed by the normalised
 * question (vertical + query + city + travel date). On the next identical or similar question the
 * assistant:
 *   1. starts from what it already knows (a warm answer instead of an empty first paint),
 *   2. ranks the sellers that historically answered THIS kind of question higher,
 *   3. tells the user the price it last verified, labelled as last-verified, never as live.
 *
 * WHAT IT MUST NEVER DO: invent a price, replay a price as live, or let an old row survive the
 * travel-date gate. Every remembered row carries `lastVerifiedAt`, and the caller only uses it for
 * ordering/recall - the live pipeline still decides what is actually shown and at what price.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';

export interface MemoryKey {
  vertical?: string;
  query?: string;
  city?: string;
  depart?: string;
}

export interface RememberedAnswer {
  key: string;
  vertical: string;
  query: string;
  city: string;
  depart: string;
  sellers: string[];
  rowCount: number;
  cheapestBySeller: Record<string, number>;
  timesSeen: number;
  lastVerifiedAt: number;
}

const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function memoryKey(k: MemoryKey): string {
  return [norm(k.vertical), norm(k.query), norm(k.city), norm(k.depart || '')].join('|');
}

const TABLE = 'assistant_search_memory';

export async function ensureSearchMemoryTable(): Promise<void> {
  const store = getStore();
  await store.execute(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (
       mem_key VARCHAR(191) PRIMARY KEY,
       vertical VARCHAR(32) NOT NULL,
       query VARCHAR(255) NOT NULL,
       city VARCHAR(80) NOT NULL DEFAULT '',
       depart VARCHAR(10) NOT NULL DEFAULT '',
       sellers TEXT NULL,
       row_count INT NOT NULL DEFAULT 0,
       cheapest_by_seller TEXT NULL,
       times_seen INT NOT NULL DEFAULT 0,
       last_verified_at BIGINT NOT NULL DEFAULT 0
     )`,
  );
}

const parseJson = <T>(raw: unknown, fallback: T): T => {
  try { return raw ? (JSON.parse(String(raw)) as T) : fallback; } catch { return fallback; }
};

/** Cheap, read-only: what do we already know about this question? */
export async function recallAnswer(k: MemoryKey): Promise<RememberedAnswer | null> {
  try {
    const rows = await getStore().query<any>(`SELECT * FROM ${TABLE} WHERE mem_key = ? LIMIT 1`, [memoryKey(k)]);
    const r = rows[0];
    if (!r) return null;
    return {
      key: String(r.mem_key),
      vertical: String(r.vertical || ''),
      query: String(r.query || ''),
      city: String(r.city || ''),
      depart: String(r.depart || ''),
      sellers: parseJson<string[]>(r.sellers, []),
      rowCount: Number(r.row_count) || 0,
      cheapestBySeller: parseJson<Record<string, number>>(r.cheapest_by_seller, {}),
      timesSeen: Number(r.times_seen) || 0,
      lastVerifiedAt: Number(r.last_verified_at) || 0,
    };
  } catch (e: any) {
    log.info('Assistant', 'search memory recall skipped', { error: String(e?.message || e).slice(0, 120) });
    return null;
  }
}

/** Seller reliability for one vertical: which sellers actually deliver rows for this vertical. */
/**
 * OWNER 4 Nov ("cpu usage km kro bina results impact kiye"): this ran a MySQL SELECT on EVERY
 * assistant answer, even though the ranking hint it produces changes on the scale of a whole
 * search sweep, not per request. It is now memoised for T1S_RELIABILITY_TTL_MS (60s) per
 * vertical|limit: same rows in, same score out, one query instead of one per question. Failures are
 * never cached (a DB hiccup must not stick for a minute).
 */
const reliabilityMemo = new Map<string, { at: number; value: Record<string, number> }>();
const RELIABILITY_TTL_MS = () => Math.max(1000, Number(process.env.T1S_RELIABILITY_TTL_MS) || 60_000);

export async function sellerReliability(vertical: string, limit = 40): Promise<Record<string, number>> {
  const memoKey = `${String(vertical)}|${limit}`;
  const hit = reliabilityMemo.get(memoKey);
  if (hit && Date.now() - hit.at < RELIABILITY_TTL_MS()) return hit.value;
  try {
    const rows = await getStore().query<any>(
      `SELECT sellers, times_seen FROM ${TABLE} WHERE vertical = ? ORDER BY last_verified_at DESC LIMIT ?`,
      [String(vertical), Math.max(1, Math.min(200, limit))],
    );
    const score: Record<string, number> = {};
    for (const r of rows) {
      const seen = Math.max(1, Number(r.times_seen) || 1);
      for (const s of parseJson<string[]>(r.sellers, [])) {
        score[s] = (score[s] || 0) + seen;
      }
    }
    reliabilityMemo.set(memoKey, { at: Date.now(), value: score });
    if (reliabilityMemo.size > 200) reliabilityMemo.clear(); // bounded: one entry per vertical
    return score;
  } catch {
    return {}; // never cached, so a DB hiccup cannot stick for a minute
  }
}

/**
 * Record what a search actually produced. Called by the assistant (and by /api/search) after a
 * settled answer; empty answers never overwrite a good memory, exactly like lastKnownGood.
 */
export async function rememberAnswer(k: MemoryKey, answer: {
  rows: any[];
  sellers?: string[];
  at?: number;
}): Promise<void> {
  const rows = answer.rows || [];
  if (!rows.length) return;
  const sellers = new Set<string>(answer.sellers || []);
  const cheapest: Record<string, number> = {};
  for (const r of rows) {
    const seller = String(r?.seller || r?.vendor || r?.provider || '').trim();
    if (!seller) continue;
    sellers.add(seller);
    const price = Number(
      r?.prices?.effectivePrice ?? r?.prices?.mandatoryTotal ?? r?.price ?? r?.prices?.listPrice ?? 0,
    );
    if (Number.isFinite(price) && price > 0) {
      cheapest[seller] = Math.min(cheapest[seller] || Infinity, price);
    }
  }
  const key = memoryKey(k);
  const at = Number(answer.at) || Date.now();
  try {
    await getStore().execute(
      `INSERT INTO ${TABLE} (mem_key, vertical, query, city, depart, sellers, row_count, cheapest_by_seller, times_seen, last_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         sellers = VALUES(sellers),
         row_count = VALUES(row_count),
         cheapest_by_seller = VALUES(cheapest_by_seller),
         times_seen = times_seen + 1,
         last_verified_at = VALUES(last_verified_at)`,
      [
        key,
        String(k.vertical || '').slice(0, 32),
        String(k.query || '').slice(0, 255),
        String(k.city || '').slice(0, 80),
        String(k.depart || '').slice(0, 10),
        JSON.stringify([...sellers]),
        rows.length,
        JSON.stringify(cheapest),
        at,
      ],
    );
  } catch (e: any) {
    log.info('Assistant', 'search memory write skipped', { error: String(e?.message || e).slice(0, 120) });
  }
}

/**
 * Pure ranking hint: reorder rows so sellers with a track record come first WITHOUT changing any
 * price or dropping a row. Stable for equal scores, so the existing ranking still decides ties.
 */
export function boostByReliability<T extends Record<string, any>>(rows: T[], reliability: Record<string, number>): T[] {
  if (!rows.length || !Object.keys(reliability).length) return rows;
  const score = (r: any) => reliability[String(r?.seller || r?.vendor || r?.provider || '')] || 0;
  return rows
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.r);
}

/** The line the assistant says when it is leaning on memory (kept honest, no live claim). */
export function memoryNotice(mem: RememberedAnswer | null): string | undefined {
  if (!mem || !mem.rowCount) return undefined;
  const when = new Date(mem.lastVerifiedAt).toISOString().slice(0, 16).replace('T', ' ');
  return `Last time you asked this, ${mem.rowCount} live rows came from ${mem.sellers.slice(0, 4).join(', ') || 'our sources'} (verified ${when}Z). I start from those and re-check prices now.`;
}
