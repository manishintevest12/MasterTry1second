/**
 * SELLER MEMORY (owner 3 Nov): "jo slow hai unka wait kr ke results lao ek search pr miss ni krna
 * kissi ko v aur ho sake the cache aur memory aisa bnao ki ye sb ka data humere paas humesa rahe
 * sirf new price date wise ke liye next time se mehnat kre naa ki recurring same data ke liye sb
 * vertical pr".
 *
 * Two jobs, both per vertical and both keyed on the ROUTE, not on the whole query string:
 *
 *  1) NEVER LOSE A SELLER. Every source that ever answered for a route+date is written here with its
 *     own rows. When the next search for that same route+date runs and a seller is slow (still
 *     fetching) or gated, its last known rows are merged back into the answer instead of vanishing -
 *     so the feed stops flip-flopping between 2 sellers and 6. Merged rows are flagged
 *     (attributes.seller_memory = '1' + memory_age_ms) and still have to pass the SAME date / price /
 *     city gates downstream, so memory can never smuggle a wrong-date or priceless card in.
 *
 *  2) ONLY NEW WORK EXPENSIVE. The stored rows are the per-date price set, so a repeat of the same
 *     route+date costs nothing to rebuild and a NEW date only has to fetch that date. The route/date
 *     key is deliberately separate from the cache key: cache keeps the FINISHED answer, this keeps
 *     the raw seller evidence behind it.
 */
import { getStore } from '../common/db';

export interface SellerMemoryKey {
  vertical: string;
  routeKey: string;
  dateKey: string;
}

export interface SellerSnapshot {
  seller: string;
  sourceId?: string;
  rows: any[];
  fetchedAt?: string;
}

const clean = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Loose route identity: same corridor from any phrasing ("Indore (IDR) to New Delhi (DEL)" vs
 *  "IDR-DEL") must land on the same memory slot, otherwise the memory would never hit. */
export function routeKeyOf(parts: { query?: string; city?: string; pincode?: string; origin?: string; destination?: string }): string {
  const q = clean(parts.query).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const origin = clean(parts.origin);
  const destination = clean(parts.destination);
  const corridor = origin && destination ? `${origin}>${destination}` : q;
  return [corridor, clean(parts.city), clean(parts.pincode)].filter(Boolean).join('|').slice(0, 240) || 'global';
}

export function dateKeyOf(depart?: string, ret?: string): string {
  const d = String(depart ?? '').slice(0, 10);
  const r = String(ret ?? '').slice(0, 10);
  return d ? (r ? `${d}_${r}` : d) : 'any';
}

/** A seller is identified by its shop name; sourceId is the fallback for sources that do not name
 *  one, so two unnamed sources never collapse into a single memory bucket. */
export function sellerKeyOf(offer: any): string {
  const candidates = [offer?.seller, offer?.vendor, offer?.attributes?.seller, offer?.attributes?.merchant, offer?.sourceId, offer?.source];
  for (const c of candidates) {
    const v = String(c ?? '').trim();
    if (v && v !== 'undefined' && v !== 'null') return v;
  }
  return '';
}

let schemaReady = false;
export async function ensureSellerMemorySchema(): Promise<void> {
  if (schemaReady) return;
  const store = getStore();
  await store.execute(`
    CREATE TABLE IF NOT EXISTS seller_memory (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      vertical VARCHAR(32) NOT NULL,
      route_key VARCHAR(255) NOT NULL,
      date_key VARCHAR(32) NOT NULL,
      seller VARCHAR(160) NOT NULL,
      source_id VARCHAR(160) NULL,
      rows_json MEDIUMTEXT NOT NULL,
      row_count INT NOT NULL DEFAULT 0,
      fetched_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_seller_memory (vertical, route_key, date_key, seller),
      KEY idx_seller_memory_route (vertical, route_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
}

/** Persist what each seller just told us. Best effort: memory must never break a search. */
export async function saveSellerMemory(key: SellerMemoryKey, offers: any[]): Promise<number> {
  try {
    await ensureSellerMemorySchema();
    const bySeller = new Map<string, any[]>();
    for (const o of offers || []) {
      const seller = sellerKeyOf(o);
      if (!seller) continue;
      const list = bySeller.get(seller) || [];
      list.push(o);
      bySeller.set(seller, list);
    }
    if (!bySeller.size) return 0;
    const store = getStore();
    for (const [seller, rows] of bySeller) {
      const json = JSON.stringify(rows);
      if (json.length > 4_000_000) continue; // pathological source payload: skip, never truncate rows
      await store.execute(
        `INSERT INTO seller_memory (vertical, route_key, date_key, seller, source_id, rows_json, row_count, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE source_id = VALUES(source_id), rows_json = VALUES(rows_json),
           row_count = VALUES(row_count), fetched_at = NOW()`,
        [key.vertical, key.routeKey, key.dateKey, seller, String(rows[0]?.sourceId || '').slice(0, 160), json, rows.length],
      );
    }
    return bySeller.size;
  } catch {
    return 0;
  }
}

export async function loadSellerMemory(key: SellerMemoryKey, staleAfterMs?: number): Promise<SellerSnapshot[]> {
  try {
    await ensureSellerMemorySchema();
    const store = getStore();
    const params: any[] = [key.vertical, key.routeKey, key.dateKey];
    let sql = `SELECT seller, source_id, rows_json, fetched_at FROM seller_memory WHERE vertical = ? AND route_key = ? AND date_key = ?`;
    if (staleAfterMs && staleAfterMs > 0) {
      sql += ` AND fetched_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)`;
      params.push(Math.floor(staleAfterMs / 1000));
    }
    const rows = await store.query<any>(sql, params);
    return (rows || []).map((r: any) => {
      let parsed: any[] = [];
      try { parsed = JSON.parse(r.rows_json || '[]'); } catch { parsed = []; }
      return {
        seller: String(r.seller || ''),
        sourceId: r.source_id || undefined,
        rows: Array.isArray(parsed) ? parsed : [],
        fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : undefined,
      };
    }).filter((s) => s.seller && s.rows.length);
  } catch {
    return [];
  }
}

/**
 * Merge remembered seller rows for sellers the live pass did not deliver. Pure (no DB) so the rule is
 * testable: a seller already present live is NEVER duplicated, and every merged row carries an
 * honest age stamp instead of pretending to be a fresh quote.
 */
export function mergeSellerMemory(liveOffers: any[], snaps: SellerSnapshot[], now = Date.now()): { offers: any[]; restored: string[] } {
  const offers = [...(liveOffers || [])];
  const liveSellers = new Set(offers.map(sellerKeyOf).filter(Boolean));
  const restored: string[] = [];
  for (const snap of snaps || []) {
    if (!snap?.seller || !Array.isArray(snap.rows) || !snap.rows.length) continue;
    if (liveSellers.has(snap.seller)) continue;
    const age = snap.fetchedAt ? Math.max(0, now - new Date(snap.fetchedAt).getTime()) : null;
    for (const row of snap.rows) {
      const copy = { ...row };
      copy.attributes = { ...(row?.attributes || {}), seller_memory: '1' };
      if (age !== null) copy.attributes.memory_age_ms = String(age);
      copy.prices = { ...(row?.prices || {}) };
      offers.push(copy);
    }
    liveSellers.add(snap.seller);
    restored.push(snap.seller);
  }
  return { offers, restored };
}
