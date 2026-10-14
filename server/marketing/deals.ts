/**
 * Deals registry: merchant-wise offers / coupon codes / bank, card, gift-card, loan,
 * insurance and movie offers. Admin-managed, shown only when active and not expired.
 * Affiliate IDs never live here: every click goes through /api/out (masking pointer) and
 * buildSecureDeeplink() attaches the affiliate profile on the server.
 */
import { getStore } from '../common/db';
import { createMaskingPointer } from '../affiliate/deeplink';

export const DEAL_KINDS = ['bank_offer', 'coupon', 'gift_card', 'credit_card', 'loan', 'insurance', 'movie', 'cashback', 'sale'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

export interface DealInput {
  id?: number;
  merchant_key: string; merchant_name: string; kind: string; title: string;
  description?: string | null; code?: string | null; discount_text?: string | null;
  min_order?: number | null; terms?: string | null; dest_url: string;
  valid_till?: string | null; sort_weight?: number; is_active?: boolean;
}

/** Match key used for seller-name lookups: "Flipkart Minutes" / "flipkart.com" -> "flipkart". */
export function merchantKeyOf(name: string): string {
  const s = String(name || '').toLowerCase().replace(/\.(com|in|co\.in)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const first = s.split(' ')[0] || '';
  const alias: Record<string, string> = { amzn: 'amazon', 'tata': 'tatacliq', bms: 'bookmyshow', book: 'bookmyshow', paytm: 'district' };
  return alias[first] || first;
}

function httpsUrl(raw: string): string | null {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
    return u.toString().slice(0, 1000);
  } catch { return null; }
}

export function validateDeal(i: DealInput): { ok: boolean; error?: string; clean?: any } {
  const merchant_name = String(i.merchant_name || '').trim().slice(0, 120);
  const title = String(i.title || '').trim().slice(0, 200);
  const kind = String(i.kind || '').trim();
  if (!merchant_name) return { ok: false, error: 'Merchant name is required' };
  if (!title) return { ok: false, error: 'Title is required' };
  if (!(DEAL_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Unknown deal type' };
  const dest = httpsUrl(i.dest_url);
  if (!dest) return { ok: false, error: 'Destination must be a full https:// URL' };
  const code = String(i.code ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 60) || null;
  if (kind === 'coupon' && !code) return { ok: false, error: 'A coupon deal needs its code' };
  const till = String(i.valid_till ?? '').trim();
  if (till && !/^\d{4}-\d{2}-\d{2}$/.test(till)) return { ok: false, error: 'Valid-till must be YYYY-MM-DD' };
  const mo = i.min_order == null || (i.min_order as any) === '' ? null : Math.max(0, Math.round(Number(i.min_order)));
  return {
    ok: true,
    clean: {
      merchant_key: merchantKeyOf(i.merchant_key || merchant_name), merchant_name, kind, title,
      description: String(i.description ?? '').trim().slice(0, 600) || null, code,
      discount_text: String(i.discount_text ?? '').trim().slice(0, 80) || null,
      min_order: Number.isFinite(mo as number) ? mo : null,
      terms: String(i.terms ?? '').trim().slice(0, 600) || null,
      dest_url: dest, valid_till: till || null,
      sort_weight: Math.max(-100, Math.min(100, Math.round(Number(i.sort_weight) || 0))),
      is_active: i.is_active === false ? 0 : 1,
    },
  };
}

const isLive = (r: any, today = new Date().toISOString().slice(0, 10)) =>
  (Number(r.is_active) === 1 || r.is_active === true) && (!r.valid_till || String(r.valid_till).slice(0, 10) >= today);

/** Public shape: affiliate-free; the destination is a signed /api/out pointer. */
export function toPublicDeal(r: any) {
  return {
    id: Number(r.id), merchantKey: r.merchant_key, merchantName: r.merchant_name, kind: r.kind,
    title: r.title, description: r.description || null, code: r.code || null, discountText: r.discount_text || null,
    minOrder: r.min_order == null ? null : Number(r.min_order), terms: r.terms || null,
    imageUrl: r.image_url || null,
    validTill: r.valid_till ? String(r.valid_till).slice(0, 10) : null,
    goUrl: createMaskingPointer(String(r.dest_url), { offerId: `deal-${r.id}` }),
  };
}

export async function listAllDeals(): Promise<any[]> {
  return getStore().query<any>('SELECT * FROM deals ORDER BY id DESC LIMIT 500').catch(() => []);
}

export async function listPublicDeals(opts: { merchant?: string; kind?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await getStore().query<any>('SELECT * FROM deals WHERE is_active = ? ORDER BY sort_weight DESC, id DESC LIMIT 500', [1]).catch(() => []);
  const mk = opts.merchant ? merchantKeyOf(opts.merchant) : '';
  return rows.filter((r) => isLive(r) && (!mk || r.merchant_key === mk) && (!opts.kind || r.kind === opts.kind))
    .slice(0, Math.min(200, opts.limit || 100)).map(toPublicDeal);
}

/** Redirect-page helper: the seller's own live deals first (coupons ahead of plain sales). */
export async function dealsForSeller(seller: string, limit = 6): Promise<any[]> {
  const rank: Record<string, number> = { coupon: 0, bank_offer: 1, cashback: 2, gift_card: 3, sale: 4 };
  const all = await listPublicDeals({ merchant: seller, limit: 100 });
  return all.sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9)).slice(0, limit);
}

export async function saveDeal(i: DealInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const v = validateDeal(i);
  if (!v.ok) return { ok: false, error: v.error };
  const c = v.clean; const store = getStore();
  const vals = [c.merchant_key, c.merchant_name, c.kind, c.title, c.description, c.code, c.discount_text, c.min_order, c.terms, c.dest_url, c.valid_till, c.sort_weight, c.is_active, 'admin'];
  if (i.id) {
    const ex = await store.query<any>('SELECT id FROM deals WHERE id = ?', [Number(i.id)]);
    if (!ex.length) return { ok: false, error: 'Deal not found' };
    await store.execute(
      'UPDATE deals SET merchant_key=?, merchant_name=?, kind=?, title=?, description=?, code=?, discount_text=?, min_order=?, terms=?, dest_url=?, valid_till=?, sort_weight=?, is_active=?, source=? WHERE id=?',
      [...vals, Number(i.id)]);
    return { ok: true, id: Number(i.id) };
  }
  await store.execute(
    'INSERT INTO deals (merchant_key, merchant_name, kind, title, description, code, discount_text, min_order, terms, dest_url, valid_till, sort_weight, is_active, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', vals);
  const row = await store.query<any>('SELECT id FROM deals WHERE merchant_key = ? AND title = ? ORDER BY id DESC LIMIT 1', [c.merchant_key, c.title]);
  return { ok: true, id: row[0] ? Number(row[0].id) : undefined };
}

export async function deleteDeal(id: number): Promise<void> {
  await getStore().execute('DELETE FROM deals WHERE id = ?', [Number(id)]);
}
