/**
 * Manual promo inventory (owner 27 Oct): "admin mai offer coupon cashback ye sb v add kr
 * ske manually jisme image upload affiliate sb ho aur wo coupon, offer redirection page pr
 * copy v ho."
 *
 * One row = one promo for one merchant: coupon code, bank offer, or cashback deal, with
 * its own image, its own affiliate/tracking template and an optional window. The admin
 * picks the merchant from the registry (slug + domain), so the /redirect exit page can
 * match the promo to whatever merchant the user is leaving for.
 */
import { getStore } from '../common/db';

export const PROMO_KINDS = ['coupon', 'offer', 'cashback'] as const;
export type PromoKind = typeof PROMO_KINDS[number];

export interface PromoOffer {
  id?: number;
  merchant_slug: string;
  merchant_domain: string;
  kind: PromoKind;
  title: string;
  code: string | null;
  discount_label: string | null;
  description: string | null;
  image_url: string | null;
  url: string | null;
  affiliate_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  active: boolean;
}
export interface PromoOfferRow extends PromoOffer { id: number; clicks?: number; copies?: number }

let ensured = false;
export async function ensurePromoTable(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS promo_offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    merchant_slug VARCHAR(80) NOT NULL,
    merchant_domain VARCHAR(160) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'coupon',
    title VARCHAR(200) NOT NULL,
    code VARCHAR(60) NULL,
    discount_label VARCHAR(80) NULL,
    description VARCHAR(500) NULL,
    image_url VARCHAR(500) NULL,
    url VARCHAR(700) NULL,
    affiliate_url VARCHAR(900) NULL,
    starts_at DATE NULL,
    ends_at DATE NULL,
    priority INT NOT NULL DEFAULT 100,
    active TINYINT(1) NOT NULL DEFAULT 1,
    clicks INT NOT NULL DEFAULT 0,
    copies INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_promo_merchant (merchant_slug, active),
    KEY idx_promo_domain (merchant_domain, active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
  ensured = true;
}

export function cleanDomain(raw: unknown): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
}

export function cleanSlug(raw: unknown): string {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function isoDate(raw: unknown): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

/** Pure validator (unit-tested). Photo may be an admin upload or an https image, never blob. */
export function validatePromoOffer(input: any): { ok: boolean; error?: string; clean?: PromoOffer } {
  const merchant_slug = cleanSlug(input?.merchant_slug);
  const merchant_domain = cleanDomain(input?.merchant_domain);
  if (!merchant_slug) return { ok: false, error: 'Merchant slug is required' };
  if (!merchant_domain) return { ok: false, error: 'Merchant domain is required (e.g. agoda.com)' };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(merchant_domain)) return { ok: false, error: 'Merchant domain looks wrong' };

  const kind = String(input?.kind || 'coupon').toLowerCase() as PromoKind;
  if (!PROMO_KINDS.includes(kind)) return { ok: false, error: `Kind must be one of ${PROMO_KINDS.join(', ')}` };

  const title = String(input?.title || '').trim();
  if (title.length < 3) return { ok: false, error: 'Title is required (e.g. Flat ₹500 off on hotels)' };
  if (title.length > 200) return { ok: false, error: 'Title is too long (max 200)' };

  const code = String(input?.code || '').trim().toUpperCase().slice(0, 60) || null;
  if (kind === 'coupon' && !code) return { ok: false, error: 'A coupon needs a code so the user can copy it' };

  const image_raw = String(input?.image_url || '').trim();
  if (image_raw && !/^https:\/\//i.test(image_raw) && !/^\/api\/logos\/[A-Za-z0-9._-]+$/.test(image_raw)) {
    return { ok: false, error: 'Image must be an uploaded photo (/api/logos/…) or an https image link' };
  }

  const url = String(input?.url || '').trim() || null;
  if (url && !/^https:\/\//i.test(url)) return { ok: false, error: 'Destination must be an https link' };

  const aff = String(input?.affiliate_url || '').trim() || null;
  if (aff) {
    if (!/^https:\/\//i.test(aff)) return { ok: false, error: 'Affiliate link must be https' };
    if (!aff.includes('{url}')) return { ok: false, error: 'Affiliate link must contain {url} so the exact offer page opens' };
  }

  const starts_at = isoDate(input?.starts_at);
  const ends_at = isoDate(input?.ends_at);
  if (starts_at && ends_at && ends_at < starts_at) return { ok: false, error: 'End date is before the start date' };

  const priority = Number.isFinite(Number(input?.priority)) ? Math.max(1, Math.min(9999, Math.round(Number(input.priority)))) : 100;

  return {
    ok: true,
    clean: {
      merchant_slug, merchant_domain, kind, title, code,
      discount_label: String(input?.discount_label || '').trim().slice(0, 80) || null,
      description: String(input?.description || '').trim().slice(0, 500) || null,
      image_url: image_raw || null, url, affiliate_url: aff,
      starts_at, ends_at, priority,
      active: input?.active === undefined ? true : Boolean(input.active),
    },
  };
}

/** A promo is live only when active AND inside its window (no window = always). */
export function isPromoLive(row: any, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (!row) return false;
  if (String(row.active ?? 1) === '0' || row.active === false) return false;
  const s = row.starts_at ? String(row.starts_at).slice(0, 10) : '';
  const e = row.ends_at ? String(row.ends_at).slice(0, 10) : '';
  if (s && today < s) return false;
  if (e && today > e) return false;
  return true;
}

function rowToPromo(r: any): PromoOfferRow {
  const d = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null));
  return {
    id: Number(r.id), merchant_slug: r.merchant_slug, merchant_domain: r.merchant_domain,
    kind: r.kind, title: r.title, code: r.code || null,
    discount_label: r.discount_label || null, description: r.description || null,
    image_url: r.image_url || null, url: r.url || null, affiliate_url: r.affiliate_url || null,
    starts_at: d(r.starts_at), ends_at: d(r.ends_at),
    priority: r.priority == null ? 100 : Number(r.priority),
    active: !(String(r.active ?? 1) === '0' || r.active === false),
    clicks: r.clicks == null ? 0 : Number(r.clicks), copies: r.copies == null ? 0 : Number(r.copies),
  };
}

export async function listPromoOffers(): Promise<PromoOfferRow[]> {
  await ensurePromoTable();
  const rows = await getStore().query<any>('SELECT * FROM promo_offers ORDER BY priority ASC, id DESC LIMIT 500').catch(() => []);
  return rows.map(rowToPromo);
}

export async function savePromoOffer(input: any): Promise<{ ok: boolean; error?: string; id?: number }> {
  await ensurePromoTable();
  const v = validatePromoOffer(input);
  if (!v.ok) return { ok: false, error: v.error };
  const c = v.clean!;
  const cols = [c.merchant_slug, c.merchant_domain, c.kind, c.title, c.code, c.discount_label, c.description, c.image_url, c.url, c.affiliate_url, c.starts_at, c.ends_at, c.priority, c.active ? 1 : 0];
  const id = Number(input?.id) || 0;
  if (id) {
    await getStore().execute(
      `UPDATE promo_offers SET merchant_slug=?, merchant_domain=?, kind=?, title=?, code=?, discount_label=?, description=?, image_url=?, url=?, affiliate_url=?, starts_at=?, ends_at=?, priority=?, active=? WHERE id=?`,
      [...cols, id]);
    return { ok: true, id };
  }
  await getStore().execute(
    `INSERT INTO promo_offers (merchant_slug, merchant_domain, kind, title, code, discount_label, description, image_url, url, affiliate_url, starts_at, ends_at, priority, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    cols);
  const back = await getStore().query<any>('SELECT id FROM promo_offers WHERE merchant_slug = ? ORDER BY id DESC LIMIT 1', [c.merchant_slug]).catch(() => []);
  return { ok: true, id: back?.[0]?.id ? Number(back[0].id) : undefined };
}

export async function deletePromoOffer(id: number): Promise<void> {
  await ensurePromoTable();
  await getStore().execute('DELETE FROM promo_offers WHERE id = ?', [Number(id) || 0]);
}

/** Offers live for a merchant — matched on slug OR domain (the exit page has the host). */
export async function promosForMerchant(merchant: string, limit = 3): Promise<PromoOfferRow[]> {
  await ensurePromoTable();
  const slug = cleanSlug(merchant);
  const domain = cleanDomain(merchant);
  if (!slug && !domain) return [];
  const rows = await getStore().query<any>(
    'SELECT * FROM promo_offers WHERE (merchant_slug = ? OR merchant_domain = ?) ORDER BY priority ASC, id DESC LIMIT 40',
    [slug, domain],
  ).catch(() => []);
  return rows.map(rowToPromo).filter((r) => isPromoLive(r)).slice(0, Math.max(1, Math.min(5, limit)));
}

export async function bumpPromoCounter(id: number, field: 'clicks' | 'copies'): Promise<void> {
  await ensurePromoTable();
  const col = field === 'copies' ? 'copies' : 'clicks';
  await getStore().execute(`UPDATE promo_offers SET ${col} = ${col} + 1 WHERE id = ?`, [Number(id) || 0]).catch(() => {});
}
