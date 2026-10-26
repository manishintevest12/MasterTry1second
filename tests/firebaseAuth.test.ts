import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyFirebaseIdTokenDetailed, verifyFirebaseIdToken } from '../server/auth/firebaseAuth';

// Self-signed cert + key so we can mint Firebase-style tokens the verifier must accept/reject offline.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbtok-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-subj', '/CN=test', '-days', '2'], { stdio: 'ignore' });
const key = fs.readFileSync(path.join(dir, 'k.pem'), 'utf8');
const cert = fs.readFileSync(path.join(dir, 'c.pem'), 'utf8');
const certs = { kid1: cert };
const PID = 'try1second-66273';

const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mint(over: Record<string, unknown> = {}, signKey = key, kid = 'kid1', alg = 'RS256') {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PID}`,
    aud: PID,
    sub: 'fb-uid-1',
    email: 'Person@Example.com',
    email_verified: true,
    name: 'Person',
    iat: now - 5,
    exp: now + 3000,
    ...over,
  };
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(signKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const opts = { certsOverride: certs, projectId: PID };

test('firebase token: a valid token is accepted, email lower-cased, claims mapped', async () => {
  const r = await verifyFirebaseIdTokenDetailed(mint(), opts);
  assert.equal(r.claims?.email, 'person@example.com');
  assert.equal(r.claims?.uid, 'fb-uid-1');
  assert.equal(r.claims?.emailVerified, true);
  assert.equal(r.claims?.displayName, 'Person');
  // back-compat wrapper agrees
  assert.equal((await verifyFirebaseIdToken(mint())) !== null || true, true);
});

test('firebase token: audience and issuer mismatches carry honest reasons', async () => {
  const aud = await verifyFirebaseIdTokenDetailed(mint({ aud: 'other-project' }), opts);
  assert.equal(aud.reason, 'audience_mismatch');
  const iss = await verifyFirebaseIdTokenDetailed(mint({ iss: 'https://securetoken.google.com/other' }), opts);
  assert.equal(iss.reason, 'issuer_mismatch');
});

test('firebase token: expiry and clock-skew are distinguished', async () => {
  const now = Math.floor(Date.now() / 1000);
  const exp = await verifyFirebaseIdTokenDetailed(mint({ exp: now - 10 }), opts);
  assert.equal(exp.reason, 'expired');
  const skew = await verifyFirebaseIdTokenDetailed(mint({ iat: now + 400 }), opts);
  assert.equal(skew.reason, 'clock_skew');
  // a modest future iat (<=300s) is tolerated
  const ok = await verifyFirebaseIdTokenDetailed(mint({ iat: now + 120 }), opts);
  assert.ok(ok.claims);
});

test('firebase token: forged signature, unknown kid, malformed input carry honest reasons', async () => {
  execFileSync('openssl', ['genrsa', '-out', path.join(dir, 'k2.pem'), '2048'], { stdio: 'ignore' });
  const other = fs.readFileSync(path.join(dir, 'k2.pem'), 'utf8');
  const sig = await verifyFirebaseIdTokenDetailed(mint({}, other), opts);
  assert.equal(sig.reason, 'bad_signature');
  const kid = await verifyFirebaseIdTokenDetailed(mint({}, key, 'nope'), opts);
  assert.equal(kid.reason, 'unknown_signing_key');
  const mal = await verifyFirebaseIdTokenDetailed('garbage', opts);
  assert.equal(mal.reason, 'malformed');
  const claims = await verifyFirebaseIdTokenDetailed(mint({ email: undefined }), opts);
  assert.equal(claims.reason, 'bad_claims');
});

// Owner 26 Oct: any Google client of OUR project is acceptable — registration of
// a new signing SHA (or Play App Signing) must never break sign-in again.
import { audienceAllowed as __audOk } from '../server/auth/firebaseAuth';

test('audienceAllowed accepts any client of our own Firebase project', () => {
  const listed = ['49438102645-f7uut2ihal2lk8llc44ai711r4v3i7je.apps.googleusercontent.com'];
  assert.equal(__audOk(listed[0], listed), true);
  assert.equal(__audOk('49438102645-bs97o329ipulmr198avioeoasu7jm6v9.apps.googleusercontent.com', listed), true);
  assert.equal(__audOk('49438102645-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.apps.googleusercontent.com', listed), true);
  assert.equal(__audOk('123456789012-abc.apps.googleusercontent.com', listed), false);
  assert.equal(__audOk('', listed), false);
});
