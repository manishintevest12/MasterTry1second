/**
 * PARTNER ORDERS — what a shopper bought on the merchant's own site, as the affiliate network reports it.
 *
 * OWNER 23 Nov: "acha ye possible hai ki humere partner pr jo order dete hai wo order humere sites and flutter app
 * pr dikhe agar haan tho uss features ko add kro".
 *
 * THE HONEST BOUNDARY. When a shopper leaves us and buys on Flipkart/OYO/Amazon, the ORDER lives in their system. We
 * are a comparison site, not the seller, so we cannot read their order table — no partner gives a comparison site
 * item-level order data or delivery status. What a partner network DOES report (and what we may legally show) is the
 * CONVERSION: that an order happened, its value, the commission, and its status (pending / approved / cancelled),
 * keyed by the tracking id we sent out. That is exactly what this module stores, and the app and site label it as
 * "order reported by the partner network", never as a live order we fulfilled.
 *
 * ATTRIBUTION. A conversion can only be tied to one of our users if our exit link carried that user's id. Cuelinks
 * takes a free-form `subid`; we send the publisher id today, so a report comes back with no user attached. The
 * postback parser accepts `<publisher>.<userId>` and `<publisher>-<userId>` (see `userIdFromSubid`), so turning
 * per-user attribution on is a change of what we put in the link, not a rewrite here.
 *
 * MONEY SAFETY. Nothing in this module changes an outbound link. It only reads what a network sends.
 */

import { getStore } from '../common/db';
import { log } from '../common/logger';

export interface PartnerOrderInput {
  /** The network's own order id — the idempotency key. */
  orderRef: string;
  network: string;
  merchant: string;
  subid: string;
  userId: number | null;
  orderValue: number | null;
  commission: number | null;
  status: 'pending' | 'approved' | 'cancelled';
  orderedAt: string | null;
  sourceReport: string;
  raw: string;
}

/** The publisher id we send today; a per-user subid is `<publisher>.<userId>`. */
const PUBLISHER_HINT = /^(\d{3,})(?:[.\-_])(\d{1,12})$/;

/** Our own publisher id — a bare subid equal to it means "no user attached", not "user 278473". */
const publisherId = (): string => String(process.env.CUELINKS_PUBLISHER_ID || '278473').trim();

/**
 * Read our user id back out of a subid the network echoed to us.
 *
 * Accepts `278473.42`, `278473-42`, `278473_42`, and a bare `42` (some networks strip the prefix). Anything that is
 * not a plain positive integer after the split is refused — never invent an owner for someone's order.
 */
export function userIdFromSubid(subid: string | undefined | null): number | null {
  const raw = String(subid || '').trim();
  if (!raw) return null;
  const prefixed = raw.match(PUBLISHER_HINT);
  const candidate = prefixed ? prefixed[2] : raw;
  if (!/^\d{1,12}$/.test(candidate)) return null;
  // A plain publisher id is not a user: today's links carry no user at all, and attributing every order to
  // "user 278473" would fill the table with rows no shopper can ever see.
  if (!prefixed && candidate === publisherId()) return null;
  const id = Number(candidate);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Normalise the many words networks use for "this order paid / this order was cancelled". */
export function normalizeStatus(...values: Array<string | undefined | null>): 'pending' | 'approved' | 'cancelled' {
  const hay = values.filter(Boolean).map((v) => String(v).toLowerCase()).join(' ');
  if (!hay) return 'pending';
  if (/cancel|reject|declin|refund|return|void|invalid|fraud/.test(hay)) return 'cancelled';
  if (/approv|confirm|paid|complete|success|settled/.test(hay)) return 'approved';
  return 'pending';
}

const num = (...values: any[]): number | null => {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
};

const str = (...values: any[]): string => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

/**
 * Turn a network postback into one order. Every field name the common networks use is accepted (Cuelinks,
 * Admitad, vCommission, Impact, Amazon-style `oid`/`subid`), because the exact names differ per network and a
 * mismatch would silently drop real orders.
 *
 * Returns null when the ping carries no order id — an unidentifiable ping is never stored as an order.
 */
export function parsePostback(query: Record<string, any>, networkHint = ''): PartnerOrderInput | null {
  const q = query || {};
  const orderRef = str(q.order_id, q.orderid, q.oid, q.order_ref, q.orderRef, q.transaction_id, q.transactionid, q.txn_id, q.id);
  if (!orderRef) return null;
  const subid = str(q.subid, q.sub_id, q.subid1, q.aff_sub, q.aff_sub1, q.click_id, q.clickid, q.clickref, q.click_ref);
  const status = normalizeStatus(q.status, q.order_status, q.state, q.payment_status, q.txn_status, q.conversion_status);
  const orderValue = num(q.order_value, q.orderValue, q.sale_amount, q.amount, q.total, q.sub_total, q.subtotal, q.price, q.value);
  const commission = num(q.commission, q.payout, q.earning, q.reward, q.commission_amount, q.aff_commission);
  const merchant = str(q.merchant, q.advertiser, q.store, q.vendor, q.merchant_name, q.campaign_name);
  const network = str(q.network, q.affiliate_network, networkHint) || 'affiliate';
  const orderedAt = str(q.order_date, q.ordered_at, q.timestamp, q.date, q.created_at) || null;
  return {
    orderRef: orderRef.slice(0, 120),
    network: network.slice(0, 60),
    merchant: merchant.slice(0, 120),
    subid: subid.slice(0, 120),
    userId: userIdFromSubid(subid),
    orderValue,
    commission,
    status,
    orderedAt,
    sourceReport: 'postback',
    raw: JSON.stringify(q).slice(0, 4000),
  };
}

let tableReady = false;

/** One small table; created on first use so no migration step is needed on the host. */
export async function ensurePartnerOrdersTable(): Promise<void> {
  if (tableReady) return;
  const store: any = getStore();
  await store.execute(`
    CREATE TABLE IF NOT EXISTS partner_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_ref VARCHAR(120) NOT NULL,
      network VARCHAR(60) NOT NULL DEFAULT '',
      merchant VARCHAR(120) NOT NULL DEFAULT '',
      user_id INT NULL,
      subid VARCHAR(120) NOT NULL DEFAULT '',
      order_value DECIMAL(12,2) NULL,
      commission DECIMAL(12,2) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      ordered_at DATETIME NULL,
      source_report VARCHAR(40) NOT NULL DEFAULT 'postback',
      raw TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_order (order_ref, network),
      KEY idx_user (user_id),
      KEY idx_status (status)
    )`);
  tableReady = true;
}

/**
 * Store one reported order. Idempotent on (order_ref, network): a network that pings twice (pending, then approved)
 * updates the same row instead of showing the shopper two orders.
 */
export async function recordPartnerOrder(order: PartnerOrderInput): Promise<{ stored: boolean; id: number | null }> {
  try {
    await ensurePartnerOrdersTable();
    const store: any = getStore();
    const orderedAt = order.orderedAt && /^\d{4}-\d{2}-\d{2}/.test(order.orderedAt)
      ? order.orderedAt.slice(0, 19).replace('T', ' ')
      : null;
    await store.execute(
      `INSERT INTO partner_orders (order_ref, network, merchant, user_id, subid, order_value, commission, status, ordered_at, source_report, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         order_value = COALESCE(VALUES(order_value), order_value),
         commission = COALESCE(VALUES(commission), commission),
         user_id = COALESCE(VALUES(user_id), user_id),
         merchant = IF(VALUES(merchant) = '', merchant, VALUES(merchant)),
         raw = VALUES(raw)`,
      [order.orderRef, order.network, order.merchant, order.userId, order.subid,
        order.orderValue, order.commission, order.status, orderedAt, order.sourceReport, order.raw],
    );
    const rows = await store.query(
      `SELECT id FROM partner_orders WHERE order_ref = ? AND network = ? LIMIT 1`,
      [order.orderRef, order.network],
    );
    return { stored: true, id: rows?.[0]?.id ?? null };
  } catch (e: any) {
    log.warn('Orders', 'partner order not stored', { error: e?.message, orderRef: order.orderRef });
    return { stored: false, id: null };
  }
}

export interface PartnerOrderRow {
  orderRef: string;
  network: string;
  merchant: string;
  status: string;
  orderValue: number | null;
  commission: number | null;
  orderedAt: string | null;
}

/** One shopper's reported orders, newest first. Only rows attributed to this user are returned. */
export async function partnerOrdersForUser(userId: number, limit = 50): Promise<PartnerOrderRow[]> {
  if (!userId) return [];
  try {
    await ensurePartnerOrdersTable();
    const store: any = getStore();
    const rows = await store.query(
      `SELECT order_ref, network, merchant, status, order_value, commission, ordered_at
       FROM partner_orders WHERE user_id = ? ORDER BY COALESCE(ordered_at, created_at) DESC LIMIT ?`,
      [userId, Math.max(1, Math.min(limit, 100))],
    );
    return (rows || []).map((r: any) => ({
      orderRef: String(r.order_ref || ''),
      network: String(r.network || ''),
      merchant: String(r.merchant || ''),
      status: String(r.status || 'pending'),
      orderValue: r.order_value === null || r.order_value === undefined ? null : Number(r.order_value),
      commission: r.commission === null || r.commission === undefined ? null : Number(r.commission),
      orderedAt: r.ordered_at ? new Date(r.ordered_at).toISOString() : null,
    }));
  } catch (e: any) {
    log.warn('Orders', 'partner orders unreadable', { error: e?.message });
    return [];
  }
}
