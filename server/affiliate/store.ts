/** affiliate store: batch upsert (select-then-update/insert so it works on
 *  BOTH MySQL and the file-fallback store), plus expiry invalidation + the
 *  read model for /api/v1/offers.
 */
import { getStore } from '../common/db';
import { sanitizeBindParams } from '../common/db';
import type { UnifiedAffiliateOffer } from './types';

const COLS = 'network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code, discount_value, discount_type, affiliate_url, original_url, categories, starts_at, expires_at, status, commission_note';

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
        `INSERT INTO affiliate_offers (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const sql = `SELECT id, network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code,
               discount_value, discount_type, affiliate_url, original_url, categories, starts_at, expires_at, status, created_at, updated_at
               FROM affiliate_offers WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`;
  return store.query(sql, params);
}
