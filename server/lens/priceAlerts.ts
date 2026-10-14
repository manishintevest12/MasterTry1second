/**
 * Real price-drop alerts for the in-site product page.
 * A signed-in user sets a target price; the refresh worker re-searches the product,
 * and when a VERIFIED same-product price is at or below the target we e-mail them once.
 * We never claim a drop without a live price, and never e-mail without Resend confirming.
 */
import { getStore } from '../common/db';
import { sendEmail } from '../auth/mailer';
import { log } from '../common/logger';

export interface PriceAlertInput {
  userId: number;
  email: string;
  productTitle: string;
  searchQuery: string;
  sourceUrl?: string | null;
  image?: string | null;
  targetPrice: number;
  priceAtSet?: number | null;
}

const isActive = (r: any) => r.is_active === undefined || r.is_active === null || Number(r.is_active) === 1 || r.is_active === true;

export function validateAlert(i: Partial<PriceAlertInput>): { ok: boolean; error?: string } {
  if (!i.userId) return { ok: false, error: 'Sign in to set a price alert.' };
  if (!i.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email)) return { ok: false, error: 'A valid email is needed to notify you.' };
  if (!i.productTitle || String(i.productTitle).trim().length < 3) return { ok: false, error: 'Product name is missing.' };
  if (!i.searchQuery || String(i.searchQuery).trim().length < 2) return { ok: false, error: 'Product search text is missing.' };
  const t = Math.round(Number(i.targetPrice));
  if (!Number.isFinite(t) || t <= 0 || t > 100_000_000) return { ok: false, error: 'Enter a valid target price.' };
  if (i.priceAtSet && t >= Math.round(Number(i.priceAtSet))) return { ok: false, error: 'Target must be lower than the current price.' };
  return { ok: true };
}

export async function createAlert(i: PriceAlertInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const v = validateAlert(i);
  if (!v.ok) return v;
  const store = getStore();
  const mine = (await store.query<any>('SELECT id, search_query, is_active FROM price_alerts WHERE user_id = ?', [i.userId]))
    .filter(isActive);
  if (mine.length >= 50) return { ok: false, error: 'You have reached the 50 active alert limit.' };
  const dup = mine.find((r) => String(r.search_query).toLowerCase() === i.searchQuery.trim().toLowerCase());
  if (dup) {
    await store.execute('UPDATE price_alerts SET target_price=?, price_at_set=?, notified_at=?, email=? WHERE id=?',
      [Math.round(i.targetPrice), i.priceAtSet ?? null, null, i.email, Number(dup.id)]);
    return { ok: true, id: Number(dup.id) };
  }
  const res: any = await store.execute(
    `INSERT INTO price_alerts (user_id, email, product_title, search_query, source_url, image, target_price, price_at_set, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.userId, i.email, i.productTitle.trim().slice(0, 300), i.searchQuery.trim().slice(0, 300),
     (i.sourceUrl || '').slice(0, 1000) || null, (i.image || '').slice(0, 1000) || null,
     Math.round(i.targetPrice), i.priceAtSet ?? null, 1],
  );
  const rows = await store.query<any>('SELECT id FROM price_alerts WHERE user_id = ?', [i.userId]);
  return { ok: true, id: Number(res?.insertId ?? rows[rows.length - 1]?.id) };
}

export async function listAlerts(userId: number): Promise<any[]> {
  const rows = await getStore().query<any>('SELECT * FROM price_alerts WHERE user_id = ?', [userId]);
  return rows.filter(isActive).sort((a, b) => Number(b.id) - Number(a.id));
}

export async function deleteAlert(userId: number, id: number): Promise<boolean> {
  const rows = await getStore().query<any>('SELECT id FROM price_alerts WHERE user_id = ?', [userId]);
  if (!rows.some((r) => Number(r.id) === Number(id))) return false;
  await getStore().execute('UPDATE price_alerts SET is_active = ? WHERE id = ?', [0, Number(id)]);
  return true;
}

/** Pure: should this alert fire for the freshly observed verified price? */
export function shouldNotify(alert: { target_price: number; notified_at?: any }, livePrice: number): boolean {
  if (alert.notified_at) return false;
  return Number.isFinite(livePrice) && livePrice > 0 && livePrice <= Number(alert.target_price);
}

export function alertEmail(a: { product_title: string; target_price: number }, price: number, seller: string, url: string) {
  const inr = (n: number) => `\u20B9${Math.round(n).toLocaleString('en-IN')}`;
  const subject = `Price drop: ${a.product_title.slice(0, 70)} is now ${inr(price)}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
  <h2 style="color:#E7000B;margin:0 0 8px">Your Try1Second price alert hit</h2>
  <p><strong>${escapeHtml(a.product_title)}</strong></p>
  <p style="font-size:22px;margin:6px 0"><strong>${inr(price)}</strong> on ${escapeHtml(seller)}</p>
  <p style="color:#475569">Your target was ${inr(a.target_price)}.</p>
  <p><a href="${url}" style="background:#E7000B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the deal</a></p>
  <p style="color:#94a3b8;font-size:12px">Price observed live by Try1Second. Prices can change quickly.</p></div>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * One checking pass (called by the refresh worker). `findLivePrice` is injected so this stays testable
 * and the worker supplies the real search; it must return only a VERIFIED same-product price.
 */
export async function checkAlertsOnce(
  findLivePrice: (query: string, title: string) => Promise<{ price: number; seller: string; url: string } | null>,
  baseUrl: string,
): Promise<{ checked: number; notified: number }> {
  const store = getStore();
  const all = (await store.query<any>('SELECT * FROM price_alerts WHERE id > ?', [0])).filter((a) => isActive(a) && !a.notified_at);
  let notified = 0;
  for (const a of all.slice(0, 40)) {
    try {
      const live = await findLivePrice(String(a.search_query), String(a.product_title));
      await store.execute('UPDATE price_alerts SET last_price=?, last_checked_at=? WHERE id=?',
        [live?.price ?? null, new Date().toISOString().slice(0, 19).replace('T', ' '), Number(a.id)]);
      if (live && shouldNotify(a, live.price)) {
        const m = alertEmail(a, live.price, live.seller, live.url.startsWith('http') ? live.url : baseUrl + live.url);
        const sent = await sendEmail(String(a.email), m.subject, m.html);
        if (sent.ok) {
          await store.execute('UPDATE price_alerts SET notified_at=? WHERE id=?', [new Date().toISOString().slice(0, 19).replace('T', ' '), Number(a.id)]);
          notified++;
        } else {
          log.warn('PriceAlerts', `Email not sent for alert ${a.id}: ${sent.error}`);
        }
      }
    } catch (e: any) {
      log.debug('PriceAlerts', `check failed for ${a.id}`, { error: String(e?.message || e).slice(0, 100) });
    }
  }
  return { checked: all.length, notified };
}
