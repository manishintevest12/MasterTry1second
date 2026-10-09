/**
 * Admin email-OTP login (Section 19): eligibility for configured admins only,
 * hashed single-use codes, cooldown, expiry, attempt limits, enumeration safety.
 * Uses the file fallback store; mail delivery is stubbed via a fake Resend server
 * (no real network, no real email).
 * Run: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'process';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAILS = 'standardpetro.in@gmail.com,k.manishkumar2009@gmail.com';
process.env.RESEND_API_KEY = 're_test_key_for_local_tests';

// Isolate the dev store
fs.rmSync(path.resolve(process.cwd(), '.data'), { recursive: true, force: true });

// Stub the Resend API before importing the service: capture sent codes in memory.
const sent: { to: string; code: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.resend.com')) {
    const html = JSON.parse(init.body).html as string;
    const m = /letter-spacing:8px[^>]*>(\d{6})</.exec(html);
    const to = JSON.parse(init.body).to[0];
    if (to === 'k.manishkumar2009@gmail.com') {
      // simulate delivery failure for the second admin
      return new Response(JSON.stringify({ message: 'simulated failure' }), { status: 403 });
    }
    if (m) sent.push({ to, code: m[1] });
    return new Response(JSON.stringify({ id: 'test-id' }), { status: 200 });
  }
  return realFetch(url, init);
}) as any;

const { requestAdminOtp, verifyAdminOtp } = await import('../server/auth/otpService.ts');

const ADMIN1 = 'standardpetro.in@gmail.com';
const ADMIN2 = 'k.manishkumar2009@gmail.com';
const OUTSIDER = 'random.person@example.com';

test('otp: code is delivered to a configured admin email', async () => {
  const r = await requestAdminOtp(ADMIN1);
  assert.equal(r.ok, true);
  assert.equal(r.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, ADMIN1);
});

test('otp: outsider gets a generic success but no email (enumeration-safe)', async () => {
  const r = await requestAdminOtp(OUTSIDER);
  assert.equal(r.ok, true);
  assert.equal(r.sent, false);
  assert.equal(sent.length, 1); // no new mail
});

test('otp: correct code verifies and is single-use', async () => {
  const r = await verifyAdminOtp(ADMIN1, sent[0].code);
  assert.equal(r.ok, true);
  assert.equal(r.email, ADMIN1);
  const again = await verifyAdminOtp(ADMIN1, sent[0].code);
  assert.equal(again.ok, false); // consumed
});

test('otp: wrong code is rejected and limited to 5 attempts', async () => {
  await requestAdminOtp(ADMIN1);
  for (let i = 0; i < 5; i++) {
    const r = await verifyAdminOtp(ADMIN1, '000000');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'Incorrect code');
  }
  const locked = await verifyAdminOtp(ADMIN1, sent[0].code);
  assert.ok(String(locked.error).includes('Too many incorrect attempts'));
});

test('otp: cooldown prevents immediate re-request', async () => {
  await requestAdminOtp(ADMIN1);
  const r = await requestAdminOtp(ADMIN1);
  assert.equal(r.ok, false);
  assert.ok(String(r.error).includes('just sent'));
});

test('otp: delivery failure surfaces an honest error and stores no usable code', async () => {
  const r = await requestAdminOtp(ADMIN2);
  assert.equal(r.ok, false);
  assert.equal(r.sent, false);
  const v = await verifyAdminOtp(ADMIN2, '123456');
  assert.equal(v.ok, false); // nothing to verify against
});
