/**
 * In-app notifications (Section: notifications hub).
 * Two producers, one drawer:
 *   1. AUTO ('price_drop') — the alert worker generates these when a VERIFIED live
 *      price for a user's tracked product hits their target. Copy is generated from
 *      REAL observed data only (price, seller, target) — never fabricated claims.
 *   2. ADMIN ('admin') — pushed from Admin → Notifications to every visitor
 *      (user_id NULL broadcast) or one signed-in user.
 * Read state is per user (notification_reads), so a broadcast stays unread for each
 * person until they open it. Anonymous visitors see broadcasts too, but read state
 * only persists for signed-in users.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';

export type NotificationKind = 'price_drop' | 'admin';

export interface NotificationInput {
  userId?: number | null;   // null = broadcast
  kind: NotificationKind;
  title: string;
  body: string;
  image?: string | null;
  ctaUrl?: string | null;
  searchQuery?: string | null;
  productTitle?: string | null;
  priceNow?: number | null;
  pricePrev?: number | null;
  targetPrice?: number | null;
  seller?: string | null;
  isActive?: boolean;
  createdBy?: string;
}

const httpsOnly = (raw?: string | null): string | null => {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https:\/\//i.test(s)) return null; // never store non-https links (http / javascript: etc.)
  return s.slice(0, 1000);
};

export function validateNotification(i: Partial<NotificationInput>): { ok: boolean; error?: string } {
  const title = String(i.title || '').trim();
  const body = String(i.body || '').trim();
  if (title.length < 3 || title.length > 200) return { ok: false, error: 'Title must be 3-200 characters.' };
  if (body.length < 3 || body.length > 1000) return { ok: false, error: 'Message must be 3-1000 characters.' };
  if (!['price_drop', 'admin'].includes(String(i.kind))) return { ok: false, error: 'Unknown notification type.' };
  const cta = String(i.ctaUrl || '').trim();
  if (cta && !/^https:\/\//i.test(cta)) return { ok: false, error: 'Link must start with https://' };
  return { ok: true };
}

/** Insert one notification row. FileStore parity: INSERT with explicit column list. */
export async function createNotification(i: NotificationInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const v = validateNotification(i);
  if (!v.ok) return v;
  const store = getStore();
  const res: any = await store.execute(
    `INSERT INTO notifications (user_id, kind, title, body, image, cta_url, search_query, product_title, price_now, price_prev, target_price, seller, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.userId ?? null, String(i.kind), String(i.title).trim().slice(0, 200), String(i.body).trim().slice(0, 1000),
     httpsOnly(i.image), httpsOnly(i.ctaUrl), (i.searchQuery || '').slice(0, 300) || null,
     (i.productTitle || '').slice(0, 300) || null,
     i.priceNow != null ? Math.round(i.priceNow) : null, i.pricePrev != null ? Math.round(i.pricePrev) : null,
     i.targetPrice != null ? Math.round(i.targetPrice) : null, (i.seller || '').slice(0, 120) || null,
     i.isActive === false ? 0 : 1, (i.createdBy || 'system').slice(0, 190)],
  );
  const rows = await store.query<any>('SELECT id FROM notifications');
  const id = Number(res?.insertId ?? rows[rows.length - 1]?.id ?? 0);
  log.info('Notifications', `Created ${i.kind} notification ${id}${i.userId ? ` for user ${i.userId}` : ' (broadcast)'}`);
  return { ok: true, id };
}

/**
 * AUTO producer: the alert worker found a VERIFIED same-product price at/below the
 * user's target. Generate honest copy from the observed data (no invented discounts).
 */
export function priceDropCopy(a: { product_title: string; target_price: number }, price: number, seller: string): { title: string; body: string } {
  const inr = (n: number) => `\u20B9${Math.round(n).toLocaleString('en-IN')}`;
  const pct = Math.round((1 - price / Number(a.target_price)) * 100);
  const title = `Price drop: ${a.product_title.slice(0, 90)} is now ${inr(price)}`;
  const body = pct > 0
    ? `Your tracked product just hit ${inr(price)} on ${seller} — ${pct}% below your ${inr(a.target_price)} target. Live price verified by Try1second a moment ago. Tap to open the product page and grab the deal.`
    : `Your tracked product just hit ${inr(price)} on ${seller}, matching your ${inr(a.target_price)} target. Live price verified by Try1second a moment ago. Tap to open the product page.`;
  return { title, body };
}

/** Called by the price-alert checker: persist the in-app notification for a verified drop. */
export async function recordPriceDropNotification(
  alert: { id: number; user_id: number; product_title: string; search_query: string; target_price: number; image?: string | null },
  live: { price: number; seller: string; url: string },
): Promise<void> {
  try {
    const copy = priceDropCopy(alert, live.price, live.seller);
    await createNotification({
      userId: Number(alert.user_id),
      kind: 'price_drop',
      title: copy.title,
      body: copy.body,
      image: alert.image || null,
      ctaUrl: live.url.startsWith('https://') ? live.url : null,
      searchQuery: alert.search_query,
      productTitle: alert.product_title,
      priceNow: live.price,
      targetPrice: Number(alert.target_price),
      seller: live.seller,
      createdBy: 'alert-worker',
    });
  } catch (e: any) {
    log.warn('Notifications', `Could not persist drop notification for alert ${alert.id}`, { error: String(e?.message || e).slice(0, 100) });
  }
}

/** Admin list (newest first). */
export async function listAllNotifications(limit = 100): Promise<any[]> {
  return getStore().query<any>('SELECT * FROM notifications ORDER BY id DESC LIMIT ?', [limit]).catch(() => []);
}

/** Soft-delete an admin notification. */
export async function deactivateNotification(id: number): Promise<boolean> {
  const store = getStore();
  const rows = await store.query<any>('SELECT id FROM notifications WHERE id = ?', [Number(id)]);
  if (!rows.length) return false;
  await store.execute('UPDATE notifications SET is_active = ? WHERE id = ?', [0, Number(id)]);
  return true;
}

/**
 * What a signed-in user sees: their own price_drop notifications + active broadcasts.
 * Each row carries read state; unread = never read by THIS user.
 */
export async function userNotifications(userId: number, limit = 50): Promise<{ items: any[]; unread: number }> {
  const store = getStore();
  const rows = await store.query<any>('SELECT * FROM notifications WHERE is_active = ?', [1]);
  const reads = new Set(
    (await store.query<any>('SELECT notification_id FROM notification_reads WHERE user_id = ?', [Number(userId)]))
      .map((r: any) => Number(r.notification_id)),
  );
  const visible = rows
    .filter((r) => r.user_id == null || Number(r.user_id) === Number(userId))
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit)
    .map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      title: r.title,
      body: r.body,
      image: r.image || null,
      ctaUrl: r.cta_url || null,
      searchQuery: r.search_query || null,
      productTitle: r.product_title || null,
      priceNow: r.price_now != null ? Number(r.price_now) : null,
      targetPrice: r.target_price != null ? Number(r.target_price) : null,
      seller: r.seller || null,
      createdAt: r.created_at || null,
      read: reads.has(Number(r.id)),
    }));
  return { items: visible, unread: visible.filter((n) => !n.read).length };
}

/** Anonymous view: broadcasts only (no per-user read state without an account). */
export async function broadcastNotifications(limit = 50): Promise<any[]> {
  const rows = await getStore().query<any>('SELECT * FROM notifications WHERE is_active = ?', [1]);
  return rows
    .filter((r) => r.user_id == null)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit)
    .map((r) => ({
      id: Number(r.id), kind: r.kind, title: r.title, body: r.body, image: r.image || null,
      ctaUrl: r.cta_url || null, searchQuery: r.search_query || null, productTitle: r.product_title || null,
      priceNow: r.price_now != null ? Number(r.price_now) : null, targetPrice: r.target_price != null ? Number(r.target_price) : null,
      seller: r.seller || null, createdAt: r.created_at || null, read: false,
    }));
}

/** Mark one notification read for a user (idempotent). */
export async function markRead(userId: number, notificationId: number): Promise<void> {
  const store = getStore();
  const exists = await store.query<any>('SELECT notification_id FROM notification_reads WHERE notification_id = ? AND user_id = ?', [Number(notificationId), Number(userId)]);
  if (exists.length) return;
  await store.execute('INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)', [Number(notificationId), Number(userId)]);
}

/** Mark every currently-visible notification read for a user. */
export async function markAllRead(userId: number): Promise<number> {
  const store = getStore();
  const rows = await store.query<any>('SELECT * FROM notifications WHERE is_active = ?', [1]);
  const visible = rows.filter((r) => r.user_id == null || Number(r.user_id) === Number(userId));
  const reads = new Set(
    (await store.query<any>('SELECT notification_id FROM notification_reads WHERE user_id = ?', [Number(userId)]))
      .map((r: any) => Number(r.notification_id)),
  );
  let n = 0;
  for (const r of visible) {
    if (!reads.has(Number(r.id))) {
      await store.execute('INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)', [Number(r.id), Number(userId)]);
      n++;
    }
  }
  return n;
}
