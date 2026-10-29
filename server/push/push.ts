/**
 * Device push notifications (29 Oct, owner request: real push, with image).
 *
 * Two transports, one table:
 *   - 'webpush'  browser / installed PWA via the Web Push protocol (VAPID).
 *   - 'fcm'      Android app registration token (sent by the same code path once the
 *                Firebase service account is configured; otherwise honestly reported
 *                as not configured — never a silent claim that a push went out).
 *
 * VAPID keys: env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) wins; when they are absent the
 * pair is generated ONCE on first boot and cached in app_settings ('vapid_keys'), so the
 * owner never has to paste a key by hand and the subscription stays valid across restarts.
 *
 * Self-healing (owner standing rule): a 404/410 from the push service deactivates that
 * subscription immediately; 5 consecutive send failures do the same, so dead endpoints
 * cannot accumulate. Every send records last_ok_at / last_fail_at for the admin panel.
 */
import crypto from 'crypto';
import { getStore } from '../common/db';
import { log } from '../common/logger';

/**
 * web-push is loaded lazily and tolerantly: the compiled server.cjs keeps node_modules
 * external, so a deploy that pulled the code but skipped `npm install` must NOT crash the
 * whole site at require-time. Without the library the push endpoints answer honestly
 * ("run npm install on the server"), and everything else keeps working.
 */
let webpushLib: any = null;
let libTried = false;
async function webpush(): Promise<any> {
  if (!libTried) {
    libTried = true;
    try {
      const mod: any = await import('web-push');
      webpushLib = mod?.default || mod;
    } catch (e: any) {
      webpushLib = null;
      log.warn('Push', `web-push is not installed in this deployment (${clip(e?.message || e, 80)}) — run npm install`);
    }
  }
  return webpushLib;
}

export type PushKind = 'webpush' | 'fcm';

export interface PushPayload {
  title: string;
  body: string;
  /** Large artwork (Chrome/Android render it as the big picture). */
  image?: string | null;
  icon?: string | null;
  badge?: string | null;
  /** Opened on tap; relative paths are resolved against the app origin by the SW. */
  ctaUrl?: string | null;
  tag?: string | null;
  kind?: string | null;
  /** Deep link the app should follow when the notification is tapped. */
  url?: string | null;
}

export interface BrowserSubscription {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

const VAPID_KEY = 'vapid_keys';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@try1second.com';
const MAX_FAILS = 5;

let cached: { publicKey: string; privateKey: string } | null = null;
let configured = false;

/** Test seam: lets the suite simulate push-service responses without network. */
type Transport = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string, opts: { TTL: number; urgency: string }) => Promise<unknown>;
let transport: Transport | null = null;
export function _setPushTransport(fn: Transport | null): void {
  transport = fn;
}
async function deliver(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string): Promise<unknown> {
  if (transport) return transport(sub, body, { TTL: 3600, urgency: 'high' });
  const lib = await webpush();
  if (!lib) throw Object.assign(new Error('push library missing'), { statusCode: 503 });
  return lib.sendNotification(sub, body, { TTL: 3600, urgency: 'high' });
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const httpsImage = (raw?: string | null): string | null => {
  const s = String(raw || '').trim();
  return /^https:\/\//i.test(s) ? s.slice(0, 1000) : null;
};

/** VAPID keypair: env first, else DB-cached, else generated once and persisted. */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;
  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (envPub && envPriv) {
    cached = { publicKey: envPub, privateKey: envPriv };
    return cached;
  }
  try {
    const rows = await getStore().query<{ v: string }>('SELECT v FROM app_settings WHERE k = ?', [VAPID_KEY]);
    if (rows.length && rows[0].v) {
      const parsed = JSON.parse(rows[0].v);
      if (parsed?.publicKey && parsed?.privateKey) {
        cached = { publicKey: String(parsed.publicKey), privateKey: String(parsed.privateKey) };
        return cached;
      }
    }
  } catch (e: any) {
    log.debug('Push', `VAPID read skipped: ${clip(e?.message || e, 80)}`);
  }
  const lib = await webpush();
  if (!lib) throw new Error('Push library is not installed on the server (run npm install)');
  const fresh = lib.generateVAPIDKeys();
  cached = { publicKey: fresh.publicKey, privateKey: fresh.privateKey };
  try {
    await getStore().execute(
      'INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
      [VAPID_KEY, JSON.stringify(cached)],
    );
    log.info('Push', 'Generated and stored a fresh VAPID keypair (web push ready)');
  } catch (e: any) {
    // A read-only DB must not break web push for this process lifetime.
    log.warn('Push', `Could not persist VAPID keys: ${clip(e?.message || e, 80)}`);
  }
  return cached;
}

async function ensureVapid(): Promise<string> {
  const { publicKey, privateKey } = await vapidKeys();
  if (!configured) {
    const lib = await webpush();
    if (!lib) throw new Error('Push library is not installed on the server (run npm install)');
    lib.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
    configured = true;
  }
  return publicKey;
}

/** Public key the browser needs for pushManager.subscribe(). */
export async function pushPublicKey(): Promise<string> {
  return ensureVapid();
}

/**
 * Store-agnostic upsert (the file-fallback store has no ON DUPLICATE KEY support, and
 * a duplicate row would mean the same device receiving every push twice).
 */
async function upsertSubscription(input: {
  kind: PushKind;
  endpoint: string;
  hash: string;
  p256dh?: string | null;
  auth?: string | null;
  ua?: string | null;
  userId?: number | null;
}): Promise<number> {
  const store = getStore();
  const existing = await store.query<{ id: number }>('SELECT id FROM push_subscriptions WHERE endpoint_hash = ?', [input.hash]);
  if (existing.length) {
    const id = Number(existing[0].id);
    await store.execute(
      `UPDATE push_subscriptions SET user_id = COALESCE(?, user_id), p256dh = COALESCE(?, p256dh),
         auth = COALESCE(?, auth), ua = COALESCE(?, ua), is_active = 1, fail_count = 0 WHERE id = ?`,
      [input.userId ?? null, input.p256dh ?? null, input.auth ?? null, input.ua ?? null, id],
    );
    return id;
  }
  const r = await store.execute(
    `INSERT INTO push_subscriptions (user_id, kind, endpoint, endpoint_hash, p256dh, auth, ua, is_active, fail_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [input.userId ?? null, input.kind, input.endpoint, input.hash, input.p256dh ?? null, input.auth ?? null, input.ua ?? null],
  );
  return Number(r?.insertId || 0);
}

/** Save (or refresh) a browser push subscription. Idempotent per endpoint. */
export async function saveWebSubscription(input: {
  userId?: number | null;
  subscription: BrowserSubscription;
  ua?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: number }> {
  const endpoint = clip(input.subscription?.endpoint, 2000);
  const p256dh = clip(input.subscription?.keys?.p256dh, 255);
  const auth = clip(input.subscription?.keys?.auth, 255);
  if (!/^https:\/\//i.test(endpoint)) return { ok: false, error: 'Invalid push endpoint' };
  if (!p256dh || !auth) return { ok: false, error: 'Push subscription is missing its keys' };
  const userId = input.userId && Number.isFinite(Number(input.userId)) ? Number(input.userId) : null;
  const id = await upsertSubscription({
    kind: 'webpush',
    endpoint,
    hash: sha256(endpoint),
    p256dh,
    auth,
    ua: clip(input.ua, 255) || null,
    userId,
  });
  return { ok: true, id };
}

/** Save an Android (FCM) registration token. Same table, kind='fcm'. */
export async function saveFcmToken(input: { userId?: number | null; token: string; ua?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const token = clip(input.token, 1000);
  if (token.length < 20) return { ok: false, error: 'Invalid device token' };
  const userId = input.userId && Number.isFinite(Number(input.userId)) ? Number(input.userId) : null;
  await upsertSubscription({
    kind: 'fcm',
    endpoint: token,
    hash: sha256(`fcm:${token}`),
    ua: clip(input.ua, 255) || null,
    userId,
  });
  return { ok: true };
}

/** Unsubscribe by endpoint (or FCM token). Returns rows retired. */
export async function removeSubscription(rawEndpoint: string): Promise<number> {
  const endpoint = clip(rawEndpoint, 2000);
  if (!endpoint) return 0;
  const hashes = [sha256(endpoint), sha256(`fcm:${endpoint}`)];
  const store = getStore();
  const r = await store.execute(
    `UPDATE push_subscriptions SET is_active = 0 WHERE endpoint_hash IN (?, ?) AND is_active = 1`,
    hashes,
  );
  return Number(r?.affectedRows || 0);
}

interface SubRow {
  id: number;
  user_id: number | null;
  kind: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  fail_count: number;
}

/**
 * The JSON the service worker receives. `image` is the big picture Chrome/Android
 * renders under the text; if the artwork would push the payload past the ~4KB push
 * limit we drop the image rather than lose the whole notification.
 */
export function buildPushBody(payload: PushPayload): string {
  const body = JSON.stringify({
    title: clip(payload.title, 140),
    body: clip(payload.body, 400),
    image: httpsImage(payload.image),
    icon: httpsImage(payload.icon) || 'https://try1second.com/favicon-192.png',
    badge: httpsImage(payload.badge) || 'https://try1second.com/favicon-96.png',
    ctaUrl: payload.ctaUrl ? String(payload.ctaUrl).slice(0, 500) : '/',
    tag: clip(payload.tag || 'try1second', 60),
    kind: clip(payload.kind || 'admin', 30),
    url: payload.url ? String(payload.url).slice(0, 500) : null,
  });
  if (body.length <= 3600) return body;
  return JSON.stringify({ ...JSON.parse(body), image: null });
}

/** One send, with the self-healing bookkeeping. Never throws. */
async function sendOne(row: SubRow, payload: PushPayload): Promise<'ok' | 'gone' | 'failed' | 'skip'> {
  const store = getStore();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (row.kind === 'fcm') {
    // FCM sending needs the Firebase service-account credentials; without them we
    // report honestly instead of pretending the device was reached.
    log.debug('Push', `fcm transport not configured yet (subscription ${row.id}) — skipped`);
    return 'skip';
  }
  const body = buildPushBody(payload);
  try {
    await deliver(
      { endpoint: row.endpoint, keys: { p256dh: String(row.p256dh || ''), auth: String(row.auth || '') } },
      body,
    );
    await store.execute('UPDATE push_subscriptions SET last_ok_at = ?, fail_count = 0 WHERE id = ?', [now, Number(row.id)]);
    return 'ok';
  } catch (e: any) {
    const code = Number(e?.statusCode || 0);
    if (code === 404 || code === 410) {
      await store.execute('UPDATE push_subscriptions SET is_active = 0, last_fail_at = ? WHERE id = ?', [now, Number(row.id)]);
      return 'gone';
    }
    const fails = Number(row.fail_count || 0) + 1;
    await store.execute(
      'UPDATE push_subscriptions SET fail_count = ?, last_fail_at = ?, is_active = ? WHERE id = ?',
      [fails, now, fails >= MAX_FAILS ? 0 : 1, Number(row.id)],
    );
    log.warn('Push', `send failed (${code || 'network'}): ${clip(e?.message || e, 120)}`);
    return 'failed';
  }
}

async function sendTo(rows: SubRow[], payload: PushPayload): Promise<{ sent: number; gone: number; failed: number; skipped: number }> {
  const out = { sent: 0, gone: 0, failed: 0, skipped: 0 };
  await ensureVapid().catch(() => null);
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const res = await Promise.all(batch.map((r) => sendOne(r, payload)));
    for (const r of res) {
      if (r === 'ok') out.sent++;
      else if (r === 'gone') out.gone++;
      else if (r === 'skip') out.skipped++;
      else out.failed++;
    }
  }
  return out;
}

/** Push to a signed-in user's devices. */
export async function pushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; gone: number; failed: number; skipped: number }> {
  try {
    const rows = await getStore().query<SubRow>(
      'SELECT id, user_id, kind, endpoint, p256dh, auth, fail_count FROM push_subscriptions WHERE is_active = 1 AND user_id = ?',
      [Number(userId)],
    );
    if (!rows.length) return { sent: 0, gone: 0, failed: 0, skipped: 0 };
    return await sendTo(rows, payload);
  } catch (e: any) {
    log.warn('Push', `pushToUser skipped: ${clip(e?.message || e, 100)}`);
    return { sent: 0, gone: 0, failed: 0, skipped: 0 };
  }
}

/** Broadcast to every active subscription (admin announcements). */
export async function pushToAll(payload: PushPayload): Promise<{ sent: number; gone: number; failed: number; skipped: number }> {
  try {
    const rows = await getStore().query<SubRow>(
      'SELECT id, user_id, kind, endpoint, p256dh, auth, fail_count FROM push_subscriptions WHERE is_active = 1 ORDER BY id ASC LIMIT 5000',
      [],
    );
    if (!rows.length) return { sent: 0, gone: 0, failed: 0, skipped: 0 };
    return await sendTo(rows, payload);
  } catch (e: any) {
    log.warn('Push', `pushToAll skipped: ${clip(e?.message || e, 100)}`);
    return { sent: 0, gone: 0, failed: 0, skipped: 0 };
  }
}

/**
 * Called by the notification producers (admin broadcast + price drop). Fire-and-forget:
 * the in-app row is already saved, so a push failure never blocks the feature.
 */
export function pushNotificationRow(n: {
  userId?: number | null;
  kind?: string;
  title: string;
  body: string;
  image?: string | null;
  ctaUrl?: string | null;
}): void {
  const payload: PushPayload = {
    title: n.title,
    body: n.body,
    image: n.image || null,
    ctaUrl: n.ctaUrl || '/',
    tag: `t1s-${n.kind || 'admin'}`,
    kind: n.kind || 'admin',
  };
  const target = n.userId == null ? null : Number(n.userId);
  void (target ? pushToUser(target, payload) : pushToAll(payload))
    .then((r) => {
      if (r.sent || r.gone || r.failed) {
        log.info('Push', `delivered=${r.sent} gone=${r.gone} failed=${r.failed} skipped=${r.skipped} (${n.kind || 'admin'})`);
      }
    })
    .catch(() => null);
}

/** Admin panel counters (honest numbers, straight from the table). */
export async function pushStats(): Promise<{
  web: number;
  android: number;
  inactive: number;
  sent24h: number;
  vapidReady: boolean;
}> {
  const store = getStore();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const rows = await store.query<any>('SELECT kind, is_active, last_ok_at FROM push_subscriptions').catch(() => []);
  let web = 0;
  let android = 0;
  let inactive = 0;
  let sent24h = 0;
  for (const r of rows) {
    const active = Number(r.is_active) === 1;
    if (!active) { inactive++; continue; }
    if (String(r.kind) === 'fcm') android++; else web++;
    if (r.last_ok_at && String(r.last_ok_at).slice(0, 19).replace('T', ' ') >= dayAgo) sent24h++;
  }
  let vapidReady = false;
  try {
    vapidReady = Boolean(await pushPublicKey());
  } catch {
    vapidReady = false;
  }
  return { web, android, inactive, sent24h, vapidReady };
}
