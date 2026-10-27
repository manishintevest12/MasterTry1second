/**
 * Manual finance inventory (owner 27 Oct): "muje option do loan, credit card, insurance,
 * account verticals ka manually v add krne ka".
 *
 * The four finance verticals are otherwise scraped (BankBazaar/CardInsider/Paisabazaar…),
 * and a source being gated meant the owner could not publish a single lender or card he
 * has a direct deal with. These entries are written into the SAME `offers` table the
 * scraped rows use, tagged attributes.manual = 1 + source_id 'admin_manual', so the
 * vertical feeds, comparison cards and lead forms all pick them up with no second
 * pipeline. Deleting one is a soft delete (freshness_status INVALID) so history and any
 * lead already captured stay intact.
 */
import { getStore } from '../common/db';

export const FINANCE_VERTICALS = ['loans', 'creditcards', 'insurance', 'account'] as const;
export type FinanceVertical = (typeof FINANCE_VERTICALS)[number];

const SOURCE_ID = 'admin_manual';

export interface FinanceOfferInput {
  id?: number;
  vertical: string;
  title: string;
  seller?: string | null;      // bank / insurer / broker name shown on the card
  rate_label?: string | null;  // "10.25% p.a.", "₹499/yr", "0% forex"
  price?: number | string | null; // numeric value when the card sorts by price/rate
  highlights?: string | null;  // one line of USPs
  url: string;                 // merchant / apply page (routed through /api/out)
  city?: string | null;
  active?: boolean;
  actor?: string | null;
}

function normalizeVertical(v: string): FinanceVertical | null {
  const s = String(v || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (s === 'loans' || s === 'loan') return 'loans';
  if (s === 'creditcards' || s === 'creditcard' || s === 'cards') return 'creditcards';
  if (s === 'insurance') return 'insurance';
  if (s === 'account' || s === 'accounts' || s === 'banking' || s === 'savings') return 'account';
  return null;
}

export function validateFinanceOffer(i: FinanceOfferInput): { ok: boolean; error?: string; clean?: any } {
  const vertical = normalizeVertical(i.vertical);
  if (!vertical) return { ok: false, error: 'Vertical must be loans, creditcards, insurance or account' };
  const title = String(i.title || '').trim().slice(0, 200);
  if (title.length < 3) return { ok: false, error: 'Product name is required (e.g. HDFC Personal Loan)' };
  const rawUrl = String(i.url || '').trim();
  if (!rawUrl) return { ok: false, error: 'Apply/partner URL is required' };
  let probe: URL;
  try { probe = new URL(rawUrl); } catch { return { ok: false, error: 'URL must be a full https:// link' }; }
  if (probe.protocol !== 'https:') return { ok: false, error: 'URL must start with https://' };
  const price = i.price === null || i.price === undefined || i.price === '' ? null : Number(i.price);
  if (price !== null && !Number.isFinite(price)) return { ok: false, error: 'Price/rate value must be a number' };
  return {
    ok: true,
    clean: {
      id: i.id ? Number(i.id) : undefined,
      vertical,
      title,
      seller: String(i.seller || '').trim().slice(0, 160) || title,
      rate_label: String(i.rate_label || '').trim().slice(0, 80) || null,
      price: price === null ? null : Math.max(0, price),
      highlights: String(i.highlights || '').trim().slice(0, 300) || null,
      url: rawUrl.slice(0, 1500),
      city: String(i.city || '').trim().slice(0, 120) || null,
      active: i.active === false ? 0 : 1,
      actor: String(i.actor || '').trim().slice(0, 120) || null,
    },
  };
}

const attrsOf = (row: any): any => {
  try { return typeof row.attributes === 'string' ? JSON.parse(row.attributes) : (row.attributes || {}); } catch { return {}; }
};

/** Admin list: every manual finance entry, newest first, all four verticals. */
export async function listManualFinanceOffers(vertical?: string): Promise<any[]> {
  const v = vertical ? normalizeVertical(vertical) : null;
  const rows = await getStore().query<any>(
    `SELECT id, vertical, title, seller, seller_url, effective_price, attributes, location_city, freshness_status, created_at, updated_at
       FROM offers WHERE source_id = ? ${v ? 'AND vertical = ?' : ''} ORDER BY id DESC LIMIT 400`,
    v ? [SOURCE_ID, v] : [SOURCE_ID],
  ).catch(() => []);
  return rows.map((r: any) => {
    const a = attrsOf(r);
    return {
      id: Number(r.id), vertical: r.vertical, title: r.title, seller: r.seller,
      rate_label: a.rate_label || '', highlights: a.highlights || '',
      price: r.effective_price === null ? null : Number(r.effective_price),
      url: r.seller_url || '', city: r.location_city || null,
      active: r.freshness_status !== 'INVALID',
      created_at: r.created_at, updated_at: r.updated_at,
    };
  });
}

async function log(offerId: number, vertical: string, action: 'create' | 'update' | 'delete', actor: string | null, snapshot: any) {
  await getStore().execute(
    'INSERT INTO finance_manual_log (offer_id, vertical, action, actor, snapshot) VALUES (?,?,?,?,?)',
    [offerId, vertical, action, actor, JSON.stringify(snapshot).slice(0, 4000)],
  ).catch(() => { /* log table optional */ });
}

export async function saveManualFinanceOffer(input: FinanceOfferInput): Promise<{ ok: boolean; error?: string; id?: number }> {
  const v = validateFinanceOffer(input);
  if (!v.ok) return { ok: false, error: v.error };
  const c = v.clean;
  const store = getStore();
  const attributes = JSON.stringify({
    manual: 1, rate_label: c.rate_label, highlights: c.highlights,
    // Finance summary rows carry their category in attributes on the scraped side too,
    // so the vertical engine treats a manual row exactly like a published-rate page.
    ...(c.vertical === 'loans' ? { loan_type: 'personal loan' } : {}),
    ...(c.vertical === 'creditcards' ? { card_type: 'credit card' } : {}),
    ...(c.vertical === 'insurance' ? { insurance_type: 'insurance plan' } : {}),
    ...(c.vertical === 'account' ? { account_type: 'savings account' } : {}),
    ...(c.rate_label ? { unit: c.rate_label } : {}),
  });

  if (c.id) {
    const ex = await store.query<any>('SELECT id, vertical FROM offers WHERE id = ? AND source_id = ?', [c.id, SOURCE_ID]).catch(() => []);
    if (!ex.length) return { ok: false, error: 'That entry does not exist (or is not a manual finance entry)' };
    await store.execute(
      `UPDATE offers SET vertical=?, title=?, seller=?, seller_url=?, effective_price=?, attributes=?,
         location_city=?, freshness_status=?, validation_status='VALID', fetched_at=NOW()
       WHERE id=? AND source_id=?`,
      [c.vertical, c.title, c.seller, c.url, c.price, attributes, c.city, c.active ? 'LIVE_VERIFIED' : 'INVALID', c.id, SOURCE_ID],
    );
    await log(c.id, c.vertical, 'update', c.actor, c);
    return { ok: true, id: c.id };
  }

  const res: any = await store.execute(
    `INSERT INTO offers (vertical, title, vendor, seller, seller_url, effective_price, attributes,
        location_city, currency, availability, match_state, freshness_status, validation_status, confidence,
        source_id, source_method, source_url, fetched_at, validated_at)
     VALUES (?,?,?,?,?,?,?,?, 'INR', 'in_stock', 'MATCHED', ?, 'VALID', 1.0, ?, 'manual_admin', ?, NOW(), NOW())`,
    [c.vertical, c.title, c.seller, c.seller, c.url, c.price, attributes, c.city, c.active ? 'LIVE_VERIFIED' : 'INVALID', SOURCE_ID, c.url],
  );
  const id = Number(res?.insertId || res?.insert_id || 0);
  if (id) await log(id, c.vertical, 'create', c.actor, c);
  return { ok: true, id };
}

export async function deleteManualFinanceOffer(id: number, actor?: string | null): Promise<{ ok: boolean; error?: string }> {
  const store = getStore();
  const rows = await store.query<any>('SELECT id, vertical FROM offers WHERE id = ? AND source_id = ?', [Number(id), SOURCE_ID]).catch(() => []);
  if (!rows.length) return { ok: false, error: 'Entry not found' };
  await store.execute(`UPDATE offers SET freshness_status='INVALID', updated_at=NOW() WHERE id = ? AND source_id = ?`, [Number(id), SOURCE_ID]);
  await log(Number(id), rows[0].vertical, 'delete', actor || null, rows[0]);
  return { ok: true };
}

/** Public feed rows for the vertical engine (only live manual entries). */
export async function liveManualFinanceOffers(vertical: string): Promise<any[]> {
  const v = normalizeVertical(vertical);
  if (!v) return [];
  return getStore().query<any>(
    `SELECT id, vertical, title, seller, seller_url, effective_price, attributes, location_city
       FROM offers WHERE source_id = ? AND vertical = ? AND freshness_status <> 'INVALID' ORDER BY id DESC LIMIT 50`,
    [SOURCE_ID, v],
  ).catch(() => []);
}
