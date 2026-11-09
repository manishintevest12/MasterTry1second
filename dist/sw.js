/* Try1Second service worker — device push (29 Oct, owner request: real push, with image).
 *
 * Scope '/' so it covers the whole site. No caching/cache-write logic here on purpose:
 * this worker only receives pushes and handles taps, so it can never serve a stale page.
 *
 * The push payload is the JSON the server builds in server/push/push.ts:
 *   { title, body, image, icon, badge, ctaUrl, tag, kind, url }
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Try1second', body: event.data ? String(event.data.text()) : '' };
  }

  const title = data.title || 'Try1second';
  const image = data.image || undefined;
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon-192.png',
    badge: data.badge || '/favicon-96.png',
    // Chrome/Android show `image` as the big picture below the text.
    image,
    tag: data.tag || 'try1second',
    renotify: false,
    requireInteraction: false,
    data: {
      ctaUrl: data.ctaUrl || '/',
      kind: data.kind || 'admin',
      url: data.url || null,
    },
  };

  event.waitUntil(
    (async () => {
      let target = options.data.ctaUrl;
      // Absolute artwork only: the Notification API needs a full URL for `image`.
      if (image && !/^https:\/\//i.test(image)) options.image = new URL(image, self.location.origin).href;
      await self.registration.showNotification(title, options);
      // Tell open tabs so the in-app drawer refreshes immediately.
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) client.postMessage({ type: 't1s-push', kind: options.data.kind, ctaUrl: target });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.ctaUrl) || '/';
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) {
        if (client.url.startsWith(self.location.origin)) {
          try {
            await client.focus();
            if ('navigate' in client) await client.navigate(url);
            return;
          } catch (e) {
            /* fall through to openWindow */
          }
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* A push service can rotate an endpoint; resubscribe and re-register silently so the
 * device keeps receiving pushes without the owner having to notice. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription || null;
        const sub = await self.registration.pushManager.subscribe(
          (event.oldSubscription && event.oldSubscription.options) || {
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription ? event.oldSubscription.options.applicationServerKey : undefined,
          },
        );
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        if (old) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: old.endpoint }),
          });
        }
      } catch (e) {
        /* silent: the next visit re-subscribes through the UI */
      }
    })(),
  );
});
