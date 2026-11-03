/**
 * Deals registry: merchant-wise offers / coupon codes / bank, card, gift-card, loan,
 * insurance and movie offers. Admin-managed, shown only when active and not expired.
 * Affiliate IDs never live here: every click goes through /api/out (masking pointer) and
 * buildSecureDeeplink() attaches the affiliate profile on the server.
 */
import { getStore } from '../common/db';
import { createMaskingPointer } from '../affiliate/deeplink';

export const DEAL_KINDS = ['bank_offer', 'coupon', 'gift_card', 'credit_card', 'loan', 'insurance', 'account', 'movie', 'cashback', 'sale'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

/**
 * OWNER 3 Nov: "ad humesa vertical ke hisab se hoga". The feed's vertical ids and the deals
 * registry's vertical column do not use identical spellings (movie vs movies, creditcards vs
 * credit_cards), and a mismatch would silently leave the ad slot empty or fill it with the WRONG
 * vertical's offers - the exact thing the owner is complaining about. One mapping, tested, used by
 * the ad slot resolver.
 */
const DEALS_VERTICAL_ALIAS: Record<string, string> = {
  movie: 'movies', movies: 'movies',
  cab: 'cab', ride: 'cab',
  ecommerce: 'ecommerce', grocery: 'grocery', food: 'food',
  flights: 'flights', hotels: 'hotels', bus: 'bus',
  loans: 'loans', insurance: 'insurance',
  creditcards: 'credit_cards', credit_cards: 'credit_cards', account: 'banking',
};

export function dealsVerticalFor(vertical: string): string {
  const v = String(vertical || '').toLowerCase().trim();
  return DEALS_VERTICAL_ALIAS[v] || v;
}

export const MERCHANT_VERTICAL: Record<string, string> = {
  amazon: 'ecommerce',
  flipkart: 'ecommerce',
  myntra: 'ecommerce',
  ajio: 'ecommerce',
  tatacliq: 'ecommerce',
  meesho: 'ecommerce',
  croma: 'ecommerce',
  nykaa: 'ecommerce',

  makemytrip: 'flights',
  goibibo: 'hotels',
  easemytrip: 'hotels',
  ixigo: 'hotels',
  yatra: 'hotels',
  cleartrip: 'hotels',

  goindigo: 'flights',
  akasaair: 'flights',

  booking: 'hotels',
  agoda: 'hotels',
  airbnb: 'hotels',

  redbus: 'bus',
  abhibus: 'bus',
  zingbus: 'bus',

  ola: 'cab',
  uber: 'cab',
  rapido: 'cab',
  savaari: 'cab',

  swiggy: 'food',
  zomato: 'food',
  dominos: 'food',
  pizzahut: 'food',
  eatsure: 'food',

  blinkit: 'grocery',
  zepto: 'grocery',
  instamart: 'grocery',
  bigbasket: 'grocery',

  bookmyshow: 'movies',
  district: 'movies',
  paytm: 'movies',
  pvr: 'movies',

  paisabazaar: 'loans',
  bankbazaar: 'loans',
  policybazaar: 'loans',
  moneyview: 'loans',
  kreditbee: 'loans',
  navi: 'loans',

  acko: 'insurance',
  digit: 'insurance',
  insurancedekho: 'insurance',
  ditto: 'insurance',
  coverfox: 'insurance',

  sbi: 'creditcards',
  hdfc: 'creditcards',
  axis: 'creditcards',
  icici: 'creditcards',
  cardinsider: 'creditcards',

  // Owner 21 Oct: Account vertical (Savings / Current / Demat) merchants, so
  // admin-added account offers auto-map correctly.
  groww: 'account',
  zerodha: 'account',
  upstox: 'account',
  angelone: 'account',
  paytmmoney: 'account',
  fi: 'account',
  jupiter: 'account',
};

export interface DealInput {
  id?: number;
  merchant_key: string; merchant_name: string; kind: string; title: string;
  vertical?: string | null;
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
  const mk = merchantKeyOf(i.merchant_key || merchant_name);
  const vertical = String(i.vertical || MERCHANT_VERTICAL[mk] || '').trim() || null;

  return {
    ok: true,
    clean: {
      merchant_key: mk, merchant_name, kind, vertical, title,
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
  const mk = r.merchant_key;
  const vert = r.vertical || MERCHANT_VERTICAL[mk] || null;
  return {
    id: Number(r.id), merchantKey: mk, merchantName: r.merchant_name, kind: r.kind,
    vertical: vert,
    title: r.title, description: r.description || null, code: r.code || null, discountText: r.discount_text || null,
    minOrder: r.min_order == null ? null : Number(r.min_order), terms: r.terms || null,
    imageUrl: r.image_url || null,
    validTill: r.valid_till ? String(r.valid_till).slice(0, 10) : null,
    goUrl: createMaskingPointer(String(r.dest_url), { offerId: `deal-${r.id}`, trusted: true }), // coupon registry feed
  };
}

let schemaChecked = false;
export async function ensureDealsSchema(): Promise<void> {
  if (schemaChecked) return;
  schemaChecked = true;
  const store = getStore();
  try {
    if (store.kind === 'mysql') {
      try {
        await store.execute('ALTER TABLE deals ADD COLUMN vertical VARCHAR(40) DEFAULT NULL AFTER kind');
      } catch { /* column already exists */ }
    }
    const rows = await store.query<any>("SELECT id, merchant_key, vertical FROM deals");
    for (const r of rows) {
      if (!r.vertical || r.vertical === '') {
        const v = MERCHANT_VERTICAL[r.merchant_key];
        if (v) {
          await store.execute('UPDATE deals SET vertical = ? WHERE id = ?', [v, Number(r.id)]);
        }
      }
    }
  } catch { /* best-effort schema update */ }
}

export async function listAllDeals(): Promise<any[]> {
  await ensureDealsSchema();
  return getStore().query<any>('SELECT * FROM deals ORDER BY id DESC LIMIT 500').catch(() => []);
}

export async function getDealsWithCounts(opts: {
  merchant?: string;
  kind?: string;
  vertical?: string;
  hasImage?: boolean | number | string;
  limit?: number;
} = {}): Promise<{ deals: any[]; counts: Record<string, number> }> {
  await ensureDealsSchema();
  const rows = await getStore().query<any>('SELECT * FROM deals WHERE is_active = ? ORDER BY sort_weight DESC, id DESC LIMIT 500', [1]).catch(() => []);
  const live = rows.filter((r) => isLive(r));

  // Compute counts over ALL live deals
  const counts: Record<string, number> = {};
  for (const r of live) {
    const v = r.vertical || MERCHANT_VERTICAL[r.merchant_key];
    if (v) {
      counts[v] = (counts[v] || 0) + 1;
    }
  }

  const mk = opts.merchant ? merchantKeyOf(opts.merchant) : '';
  const filterHasImage = opts.hasImage === '1' || opts.hasImage === 1 || opts.hasImage === true || opts.hasImage === 'true';

  const filtered = live.filter((r) => {
    if (mk && r.merchant_key !== mk) return false;
    if (opts.kind && r.kind !== opts.kind) return false;
    const v = r.vertical || MERCHANT_VERTICAL[r.merchant_key];
    if (opts.vertical && v !== opts.vertical) return false;
    if (filterHasImage && !Boolean(r.image_url && String(r.image_url).trim())) return false;
    return true;
  });

  const deals = filtered.slice(0, Math.min(200, opts.limit || 100)).map(toPublicDeal);
  return { deals, counts };
}

export async function listPublicDeals(opts: {
  merchant?: string;
  kind?: string;
  vertical?: string;
  hasImage?: boolean | number | string;
  limit?: number;
} = {}): Promise<any[]> {
  const { deals } = await getDealsWithCounts(opts);
  return deals;
}

/**
 * Affiliate coupons/offers for this merchant (LinkInR / Cuelinks / Admitad rows in
 * affiliate_offers), mapped into the public deal shape. Redirect page (owner 21 Oct):
 * the admin deals registry alone has no Ajio/LinkInR merchants, so the redirect modal
 * showed NO coupon for sellers whose offers only exist in the affiliate table.
 */
async function affiliateDealsForSeller(seller: string, limit = 100): Promise<any[]> {
  if (!seller || !seller.trim()) return [];
  try {
    const { listOffers } = await import('../affiliate/store');
    const rows = await listOffers({ limit: 100 });
    const needle = seller.trim().toLowerCase();
    const matched = (rows as any[]).filter((r) => {
      const m = String(r.merchant_name || '').trim().toLowerCase();
      return m && (m.includes(needle) || needle.includes(m));
    });
    return matched.slice(0, limit).map((r) => ({
      id: 1_000_000 + Number(r.id || 0),
      merchantKey: merchantKeyOf(String(r.merchant_name || '')),
      merchantName: r.merchant_name,
      kind: r.coupon_code ? 'coupon' : 'sale',
      title: String(r.title || `${r.merchant_name} offer`),
      description: r.description || null,
      code: r.coupon_code || null,
      discountText: Number(r.discount_value) > 0
        ? `${r.discount_value}${String(r.discount_type || '') === 'percentage' ? '% OFF' : ' OFF'}`
        : null,
      minOrder: null,
      terms: null,
      validTill: r.expires_at ? String(r.expires_at).slice(0, 10) : null,
      imageUrl: r.merchant_logo || null,
      goUrl: createMaskingPointer(String(r.affiliate_url || r.original_url || ''), { offerId: `aff-${r.id}`, trusted: true }), // affiliate registry feed
    }));
  } catch { return []; }
}

/** Registry + affiliate offers for one seller, deduped by merchant+code/title. */
export async function allDealsForSeller(seller: string): Promise<any[]> {
  const registry = await listPublicDeals({ merchant: seller, limit: 100 });
  const affiliate = await affiliateDealsForSeller(seller, 100);
  // Owner rule: auto-deduplicate by merchant/code — the registry copy wins.
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const d of [...registry, ...affiliate]) {
    const key = `${String(d.merchantKey || d.merchantName || '').toLowerCase()}|${String(d.code || d.title || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(d);
  }
  return merged;
}

/** Redirect-page helper: the seller's own live deals first (coupons ahead of plain sales). */
export async function dealsForSeller(seller: string, limit = 6): Promise<any[]> {
  const rank: Record<string, number> = { coupon: 0, bank_offer: 1, cashback: 2, gift_card: 3, sale: 4 };
  const all = await allDealsForSeller(seller);
  return all.sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9)).slice(0, limit);
}

function extractDiscountScore(d: any): number {
  const text = String(d.discountText || d.discount_text || '');
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) return Number(pctMatch[1]);
  const amtMatch = text.match(/(?:rs\.?|₹|\$)\s*([\d,]+)/i) || text.match(/([\d,]+)\s*(?:off|cashback|discount)/i);
  if (amtMatch) {
    const val = Number(amtMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(val) && val > 0) return val >= 100 ? val / 10 : val;
  }
  return 0;
}

export function findBestCoupon(deals: any[]): any | null {
  const candidates = deals.filter((d) => d.kind === 'coupon' || Boolean(d.code));
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    const scoreA = extractDiscountScore(a);
    const scoreB = extractDiscountScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (b.id || 0) - (a.id || 0);
  });
  return sorted[0];
}

export function findBestOffer(deals: any[]): any | null {
  const candidates = deals.filter((d) => d.kind !== 'coupon' && !d.code);
  if (!candidates.length) return null;
  const preferredKinds = new Set(['bank_offer', 'sale', 'cashback']);
  const sorted = [...candidates].sort((a, b) => {
    const prefA = preferredKinds.has(a.kind) ? 1000 : 0;
    const prefB = preferredKinds.has(b.kind) ? 1000 : 0;
    const scoreA = prefA + extractDiscountScore(a);
    const scoreB = prefB + extractDiscountScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (b.id || 0) - (a.id || 0);
  });
  return sorted[0];
}

export async function forSellerWithBest(seller: string, limit = 6): Promise<{ deals: any[]; best: { offer: any | null; coupon: any | null } }> {
  const all = await allDealsForSeller(seller);
  const deals = all.slice().sort((a: any, b: any) => {
    const rank: Record<string, number> = { coupon: 0, bank_offer: 1, cashback: 2, gift_card: 3, sale: 4 };
    return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9);
  }).slice(0, limit);
  const coupon = findBestCoupon(all);
  const offer = findBestOffer(all);
  return { deals, best: { offer, coupon } };
}

export async function saveDeal(i: DealInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  await ensureDealsSchema();
  const v = validateDeal(i);
  if (!v.ok) return { ok: false, error: v.error };
  const c = v.clean; const store = getStore();
  const vals = [c.merchant_key, c.merchant_name, c.kind, c.vertical, c.title, c.description, c.code, c.discount_text, c.min_order, c.terms, c.dest_url, c.valid_till, c.sort_weight, c.is_active, 'admin'];
  if (i.id) {
    const ex = await store.query<any>('SELECT id FROM deals WHERE id = ?', [Number(i.id)]);
    if (!ex.length) return { ok: false, error: 'Deal not found' };
    await store.execute(
      'UPDATE deals SET merchant_key=?, merchant_name=?, kind=?, vertical=?, title=?, description=?, code=?, discount_text=?, min_order=?, terms=?, dest_url=?, valid_till=?, sort_weight=?, is_active=?, source=? WHERE id=?',
      [...vals, Number(i.id)]);
    return { ok: true, id: Number(i.id) };
  }
  await store.execute(
    'INSERT INTO deals (merchant_key, merchant_name, kind, vertical, title, description, code, discount_text, min_order, terms, dest_url, valid_till, sort_weight, is_active, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', vals);
  const row = await store.query<any>('SELECT id FROM deals WHERE merchant_key = ? AND title = ? ORDER BY id DESC LIMIT 1', [c.merchant_key, c.title]);
  return { ok: true, id: row[0] ? Number(row[0].id) : undefined };
}

export async function deleteDeal(id: number): Promise<void> {
  await getStore().execute('DELETE FROM deals WHERE id = ?', [Number(id)]);
}
