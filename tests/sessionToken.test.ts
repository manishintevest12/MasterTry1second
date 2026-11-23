import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * OWNER 22 Nov (installed app: "Could not reach the referral engine — tap Refresh"): measured against
 * production, a login returned 200 with a token and then EVERY authenticated call with that token answered
 * 401 — /api/auth/me, /api/rewards/me and /api/rewards/referral/me, 10 out of 10. The session row was
 * written by one Passenger instance and never visible to the next one (the file fallback store keeps a
 * per-instance snapshot and rewrites the whole file on persist).
 *
 * These tests pin the fix: the token carries the user id and expiry and verifies on ANY instance, so
 * authentication no longer depends on a shared session row. They also pin what must still be refused:
 * a tampered payload, a forged signature, an expired token, and a different deployment's secret.
 */

process.env.SESSION_SECRET = 'test-secret-for-session-tokens-0123456789';

const { mintSessionToken, verifySessionToken, isSignedSessionToken } = await import('../server/auth/sessionToken');

const HOUR = 3600;
const NOW = 1_700_000_000_000; // fixed instant so expiry assertions are deterministic

test('a minted token verifies on another instance (no session row needed)', () => {
  const token = mintSessionToken(42, HOUR, NOW);
  assert.equal(isSignedSessionToken(token), true);
  assert.deepEqual(verifySessionToken(token, NOW + 1000), { userId: 42 });
  assert.equal(verifySessionToken(token, NOW + 30_000)?.userId, 42);
});

test('an expired token is refused', () => {
  const token = mintSessionToken(42, 60, NOW);
  assert.equal(verifySessionToken(token, NOW + 59_000)?.userId, 42);
  assert.equal(verifySessionToken(token, NOW + 61_000), null, 'one second past expiry');
});

test('a tampered payload is refused even though the shape still looks right', () => {
  const token = mintSessionToken(42, HOUR, NOW);
  const [prefix, payload, sig] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const forged = Buffer.from(JSON.stringify({ ...claims, u: 1 })).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(verifySessionToken(`${prefix}.${forged}.${sig}`, NOW), null);
});

test('a forged signature is refused', () => {
  const token = mintSessionToken(42, HOUR, NOW);
  const [prefix, payload] = token.split('.');
  const wrongSig = crypto.createHmac('sha256', 'some-other-secret').update(`${prefix}.${payload}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(verifySessionToken(`${prefix}.${payload}.${wrongSig}`, NOW), null);
});

test('garbage, legacy hex ids and empty input never verify', () => {
  // isSignedSessionToken() is only the cheap "which lookup path" prefix test; verifySessionToken() is the
  // security boundary and must reject every one of these, prefix or not.
  for (const bad of ['', 'deadbeef', crypto.randomBytes(32).toString('hex'), 't1s1', 't1s1.abc', 't1s1..', 't1s1.a.b.c']) {
    assert.equal(verifySessionToken(bad, NOW), null, bad);
  }
  for (const legacy of ['', 'deadbeef', crypto.randomBytes(32).toString('hex')]) {
    assert.equal(isSignedSessionToken(legacy), false, legacy);
  }
});

test('the same user always mints a verifiable token, and ids never collide', () => {
  const a = verifySessionToken(mintSessionToken(7, HOUR, NOW), NOW);
  const b = verifySessionToken(mintSessionToken(8, HOUR, NOW), NOW);
  assert.equal(a?.userId, 7);
  assert.equal(b?.userId, 8);
});
