import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { saveFcmToken, pushToAll, pushToUser, pushStats } from '../server/push/push';
import { getStore } from '../server/common/db';

/**
 * Android push goes out over FCM HTTP v1 with the owner's Firebase service account.
 * These tests pin the two things that decide whether a phone really shows the artwork:
 * the OAuth call that authorises us, and the exact `message` body we post to Google.
 */

const rand = Date.now() % 100000;

/** A throwaway service account: real RSA key, so the JWT signature is actually produced. */
let seq = 0;
function serviceAccount() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    project_id: 'try1second-test',
    client_email: `push-test-${++seq}@try1second-test.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function tokenFor(tag: string) {
  return `fcmtok-${tag}-${rand}-${crypto.randomUUID()}`;
}

type Call = { url: string; body: any; headers: Record<string, string> };

/** Replaces global fetch and records both hops (oauth + messages:send). */
function stubFetch(reply: { status: number; json: any }[]) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  let i = 0;
  (globalThis as any).fetch = async (url: any, init: any = {}) => {
    const body = typeof init.body === 'string' ? (init.body.trim().startsWith('{') ? JSON.parse(init.body) : init.body) : init.body;
    calls.push({ url: String(url), body, headers: (init.headers || {}) as Record<string, string> });
    const r = reply[Math.min(i++, reply.length - 1)] || { status: 200, json: {} };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json } as any;
  };
  return { calls, restore: () => { (globalThis as any).fetch = original; } };
}

test('fcm: without service-account credentials a token is never claimed as delivered', async () => {
  const saved = await saveFcmToken({ token: tokenFor('nocreds'), platform: 'android' });
  assert.equal(saved.ok, true);

  delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  delete process.env.FCM_SERVICE_ACCOUNT_FILE;
  const stub = stubFetch([{ status: 200, json: { name: 'never' } }]);
  try {
    const r = await pushToAll({ title: 'App push', body: 'no creds yet', image: 'https://cdn.test/a.jpg', kind: 'admin' });
    assert.ok(r.skipped >= 1, 'the android row is skipped, not sent');
    assert.equal(stub.calls.length, 0, 'no request goes out without credentials');
  } finally {
    stub.restore();
  }
  const stats = await pushStats();
  assert.equal(stats.fcmReady, false, 'stats tell the truth about Firebase readiness');
});

test('fcm: a real send carries the title, the body and the big-picture image', async () => {
  process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccount());
  const token = tokenFor('imaged');
  const userId = 910000 + (Date.now() % 1000);
  await saveFcmToken({ userId, token, ua: 'test-device' });

  const stub = stubFetch([
    { status: 200, json: { access_token: 'ya29.test-token', expires_in: 3600 } },
    { status: 200, json: { name: 'projects/try1second-test/messages/1' } },
  ]);
  let result: any;
  try {
    result = await pushToUser(userId, {
      title: 'Price drop: iPhone 16',
      body: 'Now ₹64,999 on Flipkart',
      image: 'https://cdn.test/iphone.jpg',
      ctaUrl: 'https://www.try1second.com/product?q=iphone%2016',
      kind: 'price_drop',
      tag: 'watch-1',
    });
  } finally {
    stub.restore();
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  }
  assert.ok(result.sent >= 1, 'the android device is counted as delivered');

  const auth = stub.calls[0];
  assert.equal(auth.url, 'https://oauth2.googleapis.com/token');
  assert.match(String(auth.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/, 'JWT bearer grant');
  assert.match(String(auth.body), /assertion=/, 'a signed assertion is presented');

  const send = stub.calls.find((c) => c.url.includes('messages:send'));
  assert.ok(send, 'the message reaches Google');
  assert.match(send!.url, /\/v1\/projects\/try1second-test\/messages:send$/);
  assert.equal(send!.headers.Authorization, 'Bearer ya29.test-token');
  assert.equal(send!.body.message.token, token, 'the device token is the recipient');
  assert.equal(send!.body.message.notification.title, 'Price drop: iPhone 16');
  assert.equal(send!.body.message.notification.body, 'Now ₹64,999 on Flipkart');
  assert.equal(send!.body.message.notification.image, 'https://cdn.test/iphone.jpg', 'artwork travels with the notification');
  assert.equal(send!.body.message.android.notification.image, 'https://cdn.test/iphone.jpg');
  assert.equal(send!.body.message.data.url, 'https://www.try1second.com/product?q=iphone%2016', 'the tap target rides in data');
  assert.equal(send!.body.message.data.kind, 'price_drop');
  assert.equal(send!.body.message.android.priority, 'HIGH');

  const rows = await getStore().query<any>('SELECT last_ok_at FROM push_subscriptions WHERE endpoint = ?', [token]);
  assert.ok(rows[0]?.last_ok_at, 'delivery is recorded so the admin counters stay honest');
});

test('fcm: an unregistered device is retired, a rejection is counted', async () => {
  process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccount());
  const dead = tokenFor('dead');
  const shaky = tokenFor('shaky');
  const deadUser = 920000 + (Date.now() % 1000);
  const shakyUser = deadUser + 1;
  await saveFcmToken({ userId: deadUser, token: dead, ua: 'dead-device' });
  await saveFcmToken({ userId: shakyUser, token: shaky, ua: 'shaky-device' });

  let stub = stubFetch([
    { status: 200, json: { access_token: 'ya29.dead' } },
    { status: 404, json: { error: { status: 'UNREGISTERED', message: 'Requested entity was not found.' } } },
  ]);
  try {
    await pushToUser(deadUser, { title: 'T', body: 'B', kind: 'admin' });
  } finally {
    stub.restore();
  }
  const deadRow = await getStore().query<any>('SELECT is_active FROM push_subscriptions WHERE endpoint = ?', [dead]);
  assert.equal(Number(deadRow[0].is_active), 0, 'a 404/UNREGISTERED token is deactivated immediately');

  // Fresh credentials so the cached access token is not reused for this phase.
  process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccount());
  stub = stubFetch([
    { status: 200, json: { access_token: 'ya29.shaky' } },
    { status: 500, json: { error: { status: 'INTERNAL', message: 'backend error' } } },
  ]);
  try {
    await pushToUser(shakyUser, { title: 'T', body: 'B', kind: 'admin' });
  } finally {
    stub.restore();
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  }
  const shakyRow = await getStore().query<any>('SELECT fail_count FROM push_subscriptions WHERE endpoint = ?', [shaky]);
  assert.ok(Number(shakyRow[0].fail_count) >= 1, 'a transient rejection increments the fail counter instead of dying silently');
});

test('fcm: a bad credential file is refusal, not a crash', async () => {
  process.env.FCM_SERVICE_ACCOUNT_JSON = '{not json';
  const stub = stubFetch([{ status: 200, json: { access_token: 'x' } }]);
  try {
    const r = await pushToAll({ title: 'T', body: 'B', kind: 'admin' });
    assert.ok(r.skipped >= 1, 'garbage credentials count as skipped');
    assert.equal(stub.calls.length, 0, 'nothing is sent with unusable credentials');
  } finally {
    stub.restore();
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  }
});
