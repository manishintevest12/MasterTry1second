/** affiliate store: batch upsert (select-then-update/insert so it works on
 *  BOTH MySQL and the file-fallback store), plus expiry invalidation + the
 *  read model for /api/v1/offers.
 */
import { getStore } from '../common/db';
import { sanitizeBindParams } from '../common/db';
import type { UnifiedAffiliateOffer } from './types';
import { linkinrCampaignFor } from './linkinr';

const COLS = 'network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code, discount_value, discount_type, affiliate_url, original_url, categories, starts_at, expires_at, status, commission_note, last_seen_at';

function iso(d?: Date | null): string | null { return d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : null; }

export async function upsertOffers(offers: UnifiedAffiliateOffer[]): Promise<number> {
  const store = getStore();
  let n = 0;
  for (const o of offers) {
    const existing = await store.query<any[]>(
      'SELECT id FROM affiliate_offers WHERE network_source = ? AND network_offer_id = ?', [o.network_source, o.network_offer_id]);
    if (existing.length > 0) {
      await store.execute(
        `UPDATE affiliate_offers SET title = ?, description = ?, coupon_code = ?, discount_value = ?, discount_type = ?,
         affiliate_url = ?, original_url = ?, categories = ?, starts_at = ?, expires_at = ?, status = ?, merchant_logo = ?, commission_note = ?, last_seen_at = NOW()
         WHERE network_source = ? AND network_offer_id = ?`,
        sanitizeBindParams([o.title, o.description ?? null, o.coupon_code ?? null, o.discount_value ?? null, o.discount_type ?? null,
          o.affiliate_url ?? null, o.original_url ?? null, (o.categories || []).join(','), iso(o.starts_at), iso(o.expires_at),
          o.status, o.merchant_logo ?? null, o.commission_note ?? null, o.network_source, o.network_offer_id]));
    } else {
      await store.execute(
        `INSERT INTO affiliate_offers (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        sanitizeBindParams([o.network_source, o.network_offer_id, o.merchant_name, o.merchant_logo ?? null, o.title, o.description ?? null,
          o.coupon_code ?? null, o.discount_value ?? null, o.discount_type ?? null, o.affiliate_url ?? null, o.original_url ?? null,
          (o.categories || []).join(','), iso(o.starts_at), iso(o.expires_at), o.status, o.commission_note ?? null]));
    }
    n += 1;
  }
  return n;
}

export async function expirePastOffers(): Promise<number> {
  const store = getStore();
  const r = await store.execute(
    `UPDATE affiliate_offers SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`, []);
  return r.affectedRows || 0;
}

// ============ Dedup + best-commission selection (owner 21 Oct) ============
// The Coupons hub must show each deal ONCE, with NO network branding, and the
// kept copy must be the one that pays the most: the redirect hop goes through
// the highest-commission affiliate available for that merchant (server-side
// ladder in deeplink.ts: admin configs > Amazon > Cuelinks-joined > LinkInR).
// Pure functions so tests can pin the behaviour without a database.

/** 'Flat 4.8%' -> 48, 'Flat ₹1900' -> 1900, 'Upto 0.6%' -> 6. */
export function parsePayoutText(text: string | null | undefined): number {
  if (!text) return 0;
  const pct = /([\d.]+)\s*%/.exec(text);
  if (pct) return Number(pct[1]) * 10;
  const rs = /₹\s*([\d,.]+)/.exec(text);
  if (rs) return Number(rs[1].replace(/,/g, ''));
  const any = /([\d.]+)/.exec(text);
  return any ? Number(any[1]) : 0;
}

/** Network fallback rank when no payout is known for the merchant. */
const NETWORK_BASE: Record<string, number> = {
  linkinr: 100, cuelinks: 40, admitad: 30, vcommission: 25, earnkaro: 20, inrdeals: 18,
};

export function normKey(s: unknown): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Highest-known-commission score for an offer row. */
export function offerCommissionScore(o: Record<string, any>): number {
  const hop = String(o.original_url || o.affiliate_url || '');
  const lir = linkinrCampaignFor(hop); // owner sheet: known payout per merchant
  return Math.max(
    parsePayoutText(o.commission_note),
    lir ? lir.payoutScore : 0,
    NETWORK_BASE[String(o.network_source || '').toLowerCase()] ?? 10,
  );
}

/**
 * Collapse duplicates (same merchant + same code, or same merchant + same
 * title for codeless deals) keeping the copy routed through the
 * highest-paying affiliate. Deterministic tie-break: commission score, then
 * later updated_at (fresher data wins).
 */
export function dedupBestOffers<T extends Record<string, any>>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const code = normKey(r.coupon_code);
    const key = `${normKey(r.merchant_name)}|${code || normKey(r.title).slice(0, 60)}`;
    const cur = best.get(key);
    if (!cur) { best.set(key, r); continue; }
    const a = offerCommissionScore(r) - offerCommissionScore(cur);
    const b = String(r.updated_at || r.created_at || '').localeCompare(String(cur.updated_at || cur.created_at || ''));
    if (a > 0 || (a === 0 && b > 0)) best.set(key, r);
  }
  return Array.from(best.values());
}

export interface OfferQuery {
  source?: string; merchant?: string; category?: string;
  hasCoupon?: boolean; search?: string;
  sort?: 'expiry_soon' | 'latest' | 'discount_high_to_low';
  limit?: number; offset?: number;
}

export async function listOffers(q: OfferQuery) {
  const store = getStore();
  const where: string[] = ["status = 'active'"];
  const params: unknown[] = [];
  if (q.source) { where.push('network_source = ?'); params.push(q.source); }
  if (q.merchant) { where.push('merchant_name LIKE ?'); params.push(`%${q.merchant}%`); }
  if (q.category) { where.push('categories LIKE ?'); params.push(`%${q.category}%`); }
  if (q.hasCoupon) { where.push('coupon_code IS NOT NULL AND coupon_code != ?'); params.push(''); }
  if (q.search) { where.push('(title LIKE ? OR merchant_name LIKE ?)'); params.push(`%${q.search}%`, `%${q.search}%`); }
  const order = q.sort === 'expiry_soon' ? 'expires_at ASC'
    : q.sort === 'discount_high_to_low' ? 'discount_value DESC'
    : 'updated_at DESC';
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 100);
  const offset = Math.max(q.offset ?? 0, 0);
  // Dedup pool: fetch a wider slice, collapse cross-network duplicates
  // keeping the highest-commission copy, then apply the caller's window.
  const pool = Math.max(limit * 4, 200);
  const sql = `SELECT id, network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code,
               discount_value, discount_type, affiliate_url, original_url, categories, starts_at, expires_at, status, commission_note, created_at, updated_at
               FROM affiliate_offers WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${pool} OFFSET ${offset}`;
  const rows = await store.query(sql, params);
  return dedupBestOffers(rows as Record<string, any>[] as any).slice(0, limit);
}
