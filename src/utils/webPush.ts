/**
 * Browser push plumbing (29 Oct, owner request: real device push, with image).
 * No UI here — the caller decides how the "enable" control looks, so this file can be
 * wired anywhere (drawer header, settings, admin panel) without changing copy.
 */

const SW_PATH = '/sw.js';

export type PushSupport =
  | 'unsupported'
  | 'insecure'      // needs https (or localhost)
  | 'default'       // never asked
  | 'granted'       // allowed
  | 'denied'        // blocked by the user in browser settings
  | 'subscribed';   // allowed AND an active subscription exists

const isSecure = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** A hung browser promise must never leave the bell stuck on "On…". */
const withTimeout = <T,>(p: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }).catch((e) => { clearTimeout(timer); reject(e); });
  });

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('try1_session');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported() || !isSecure()) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  } catch (e) {
    return null;
  }
}

export async function pushStatus(): Promise<PushSupport> {
  if (!pushSupported()) return 'unsupported';
  if (!isSecure()) return 'insecure';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH).catch(() => null);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (sub) return 'subscribed';
  return Notification.permission === 'granted' ? 'granted' : 'default';
}

/**
 * Ask for permission and subscribe. MUST be called from a user gesture (click/tap) —
 * browsers reject permission prompts without one.
 */
export async function enablePush(): Promise<{ ok: boolean; status: PushSupport; error?: string }> {
  if (!pushSupported()) return { ok: false, status: 'unsupported', error: 'This browser cannot show push notifications' };
  if (!isSecure()) return { ok: false, status: 'insecure', error: 'Push needs the https site' };

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await withTimeout(Notification.requestPermission(), 20000, 'The browser did not answer the permission prompt').catch(() => 'default' as NotificationPermission);
  if (permission !== 'granted') {
    return {
      ok: false,
      status: permission === 'denied' ? 'denied' : 'default',
      error: permission === 'denied'
        ? 'Notifications are blocked for this site in the browser settings'
        : 'Notification permission was not given',
    };
  }

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, status: 'unsupported', error: 'Could not register the push worker' };

  const keyRes = await fetch('/api/push/key').then((r) => r.json()).catch(() => null);
  const publicKey = keyRes?.publicKey as string | undefined;
  if (!publicKey) return { ok: false, status: 'unsupported', error: 'Push is not configured on the server' };

  let sub = await reg.pushManager.getSubscription().catch(() => null);
  if (!sub) {
    sub = await withTimeout(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }),
      45000,
      'The push service did not answer. Check the connection and tap Enable again.',
    ).catch(() => null);
  }
  if (!sub) return { ok: false, status: 'default', error: 'Could not create a push subscription' };

  const saved = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  }).then((r) => r.json()).catch(() => null);

  if (!saved?.success) return { ok: false, status: 'granted', error: saved?.error || 'The server did not save the subscription' };
  return { ok: true, status: 'subscribed' };
}

/** Remove this device's subscription (permission itself can only be reset in the browser). */
export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH).catch(() => null);
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => null);
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ endpoint }),
  }).catch(() => null);
  return { ok: true };
}
