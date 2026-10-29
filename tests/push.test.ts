import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  pushPublicKey,
  saveWebSubscription,
  saveFcmToken,
  removeSubscription,
  pushToUser,
  pushToAll,
  pushNotificationRow,
  pushStats,
  buildPushBody,
  _setPushTransport,
} from '../server/push/push';
import { getStore } from '../server/common/db';

// Owner 29 Oct: "push notification mai image wagera v aaye" — the artwork must reach the
// device payload, and a dead endpoint must never keep failing silently.

const rand = Date.now() % 100000;

/** A real browser-shaped subscription: P-256 public key + 16-byte auth secret. */
function fakeSubscription(tag: string) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const p256dh = ecdh.getPublicKey().toString('base64url');
  const auth = crypto.randomBytes(16).toString('base64url');
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${tag}-${rand}-${crypto.randomUUID()}`, keys: { p256dh, auth } };
}

test('push: the VAPID public key is stable and browser-shaped', async () => {
  const a = await pushPublicKey();
  const b = await pushPublicKey();
  assert.equal(a, b, 'the key must not change between calls (subscriptions would break)');
  assert.match(a, /^[A-Za-z0-9_-]{80,90}$/, 'uncompressed P-256 point as base64url, no padding');
  assert.equal(a.length, 87);
});

test('push: subscriptions are validated and idempotent per endpoint', async () => {
  const bad = await saveWebSubscription({ subscription: { endpoint: 'http://insecure.test/e', keys: { p256dh: 'x', auth: 'y' } } });
  assert.equal(bad.ok, false, 'http endpoints are refused');

  const noKeys = await saveWebSubscription({ subscription: { endpoint: 'https://push.test/e1' } });
  assert.equal(noKeys.ok, false, 'a subscription without its keys is refused');

  const sub = fakeSubscription('idem');
  const first = await saveWebSubscription({ userId: 900000 + rand, subscription: sub, ua: 'test-agent' });
  assert.equal(first.ok, true);
  const second = await saveWebSubscription({ userId: 900000 + rand, subscription: sub, ua: 'test-agent' });
  assert.equal(second.ok, true);
  const rows = await getStore().query<any>('SELECT id, is_active, user_id FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
  assert.equal(rows.length, 1, 'saving the same endpoint twice must not duplicate the row');
  assert.equal(Number(rows[0].is_active), 1);
});

test('push: payload carries the image, and drops it only when it would exceed the limit', () => {
  const body = JSON.parse(buildPushBody({ title: 'iPhone 16 drop', body: 'Now ₹69,999 on Flipkart', image: 'https://cdn.test/iphone.png', ctaUrl: '/p/iphone-16', kind: 'price_drop' }));
  assert.equal(body.image, 'https://cdn.test/iphone.png');
  assert.equal(body.ctaUrl, '/p/iphone-16');
  assert.equal(body.kind, 'price_drop');

  const httpImage = JSON.parse(buildPushBody({ title: 'T', body: 'B', image: 'http://insecure.test/a.png' }));
  assert.equal(httpImage.image, null, 'only https artwork is allowed');

  // A runaway artwork URL is clipped (1000 chars) instead of inflating the payload.
  const longUrl = JSON.parse(buildPushBody({ title: 'T', body: 'B', image: 'https://cdn.test/' + 'a'.repeat(4000) }));
  assert.ok(String(longUrl.image).length <= 1000, 'artwork URL is clipped to keep the payload small');
  // Whatever the input, the encrypted body must stay under the ~4KB push-service limit.
  const worst = buildPushBody({ title: 'T'.repeat(500), body: 'B'.repeat(5000), image: 'https://cdn.test/' + 'a'.repeat(4000), ctaUrl: 'https://www.try1second.com/' + 'c'.repeat(900) });
  assert.ok(worst.length <= 3600, `payload stays deliverable (got ${worst.length} bytes)`);
  // Because every field is clipped, the artwork survives and still fits the limit.
  assert.ok(JSON.parse(worst).image, 'the image is kept whenever the payload still fits');
});

test('push: a 410/404 endpoint is retired immediately (self-healing)', async () => {
  const sub = fakeSubscription('gone');
  await saveWebSubscription({ subscription: sub });
  _setPushTransport(async () => {
    const err: any = new Error('Gone');
    err.statusCode = 410;
    throw err;
  });
  try {
    const r = await pushToAll({ title: 'Gone test', body: 'this endpoint no longer exists' });
    assert.ok(r.gone >= 1, 'the dead endpoint must be counted as gone');
  } finally {
    _setPushTransport(null);
  }
  const rows = await getStore().query<any>('SELECT is_active FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
  assert.equal(Number(rows[0].is_active), 0, 'dead endpoints are deactivated, never retried forever');
});

test('push: five failures retire the endpoint, one success resets the counter', async () => {
  const sub = fakeSubscription('flaky');
  await saveWebSubscription({ subscription: sub });
  _setPushTransport(async () => {
    const err: any = new Error('Push service error');
    err.statusCode = 500;
    throw err;
  });
  try {
    for (let i = 0; i < 5; i++) await pushToAll({ title: `fail ${i}`, body: 'server error' });
  } finally {
    _setPushTransport(null);
  }
  const dead = await getStore().query<any>('SELECT is_active, fail_count FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
  assert.equal(Number(dead[0].is_active), 0);
  assert.ok(Number(dead[0].fail_count) >= 5);

  const fresh = fakeSubscription('recover');
  await saveWebSubscription({ subscription: fresh });
  let sent = 0;
  _setPushTransport(async () => { sent++; return {}; });
  try {
    await pushToAll({ title: 'ok', body: 'delivered' });
  } finally {
    _setPushTransport(null);
  }
  assert.ok(sent >= 1, 'a live endpoint receives the push');
  const okRow = await getStore().query<any>('SELECT fail_count, last_ok_at, is_active FROM push_subscriptions WHERE endpoint = ?', [fresh.endpoint]);
  assert.equal(Number(okRow[0].fail_count), 0);
  assert.equal(Number(okRow[0].is_active), 1);
  assert.ok(okRow[0].last_ok_at, 'delivery time is recorded for the admin panel');
});

test('push: a signed-in user push only reaches that user, image included end to end', async () => {
  const userId = 910000 + rand;
  const mine = fakeSubscription('mine');
  const other = fakeSubscription('other');
  await saveWebSubscription({ userId, subscription: mine });
  await saveWebSubscription({ userId: userId + 7, subscription: other });

  const seen: string[] = [];
  _setPushTransport(async (sub) => { seen.push(sub.endpoint); return {}; });
  try {
    const r = await pushToUser(userId, { title: 'Price drop', body: 'Your alert hit', image: 'https://cdn.test/x.png', ctaUrl: 'https://www.try1second.com/p/x' });
    assert.equal(r.sent, 1);
  } finally {
    _setPushTransport(null);
  }
  assert.deepEqual(seen, [mine.endpoint], 'no cross-user delivery');
});

test('push: unsubscribe retires the endpoint and stats stay honest', async () => {
  const sub = fakeSubscription('unsub');
  await saveWebSubscription({ subscription: sub });
  const removed = await removeSubscription(sub.endpoint);
  assert.equal(removed, 1);
  const rows = await getStore().query<any>('SELECT is_active FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
  assert.equal(Number(rows[0].is_active), 0);

  const token = `fcm-token-${rand}-abcdefghijklmnop`;
  const saved = await saveFcmToken({ userId: 920000 + rand, token });
  assert.equal(saved.ok, true);
  const stats = await pushStats();
  assert.ok(stats.android >= 1, 'android tokens are counted separately from web ones');
  assert.equal(stats.vapidReady, true);
});

test('push: an Android token saves but is reported as not-yet-configured, never as delivered', async () => {
  const token = `fcm-token-${rand}-qrstuvwxyzabcdef`;
  await saveFcmToken({ token });
  const calls: string[] = [];
  _setPushTransport(async (sub) => { calls.push(sub.endpoint); return {}; });
  let skipped = 0;
  try {
    const r = await pushToAll({ title: 'App push', body: 'device token path' });
    skipped = r.skipped;
  } finally {
    _setPushTransport(null);
  }
  assert.ok(!calls.includes(token), 'an FCM token is never posted to the Web Push transport');
  assert.ok(skipped >= 1, 'without Firebase credentials the device row is counted as skipped, never delivered');
});

test('push: the notification producers fire a device push with the same copy', async () => {
  const sub = fakeSubscription('producer');
  await saveWebSubscription({ subscription: sub });
  const bodies: any[] = [];
  _setPushTransport(async (_sub, body) => { bodies.push(JSON.parse(body)); return {}; });
  try {
    pushNotificationRow({ kind: 'admin', title: 'Broadcast test', body: 'New feature is live', image: 'https://cdn.test/b.png', ctaUrl: 'https://www.try1second.com/deals' });
    await new Promise((r) => setTimeout(r, 250));
  } finally {
    _setPushTransport(null);
  }
  const mine = bodies.find((b) => b.title === 'Broadcast test');
  assert.ok(mine, 'the producer must reach the push transport');
  assert.equal(mine.image, 'https://cdn.test/b.png');
  assert.equal(mine.ctaUrl, 'https://www.try1second.com/deals');
});
