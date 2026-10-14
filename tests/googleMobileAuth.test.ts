import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyGoogleIdToken } from '../server/auth/firebaseAuth';

// Self-signed cert + key so we can mint tokens the verifier must accept/reject offline.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtok-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-subj', '/CN=test', '-days', '2'], { stdio: 'ignore' });
const key = fs.readFileSync(path.join(dir, 'k.pem'), 'utf8');
const cert = fs.readFileSync(path.join(dir, 'c.pem'), 'utf8');
const certs = { kid1: cert };
const AUD = 'web-client-123.apps.googleusercontent.com';

const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mint(over: Record<string, unknown> = {}, signKey = key, kid = 'kid1', alg = 'RS256') {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://accounts.google.com', aud: AUD, sub: 'g-uid-1', email: 'Person@Example.com', email_verified: true, name: 'Person', iat: now - 5, exp: now + 3000, ...over };
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(signKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}

test('google mobile token: a valid token is accepted and email lower-cased', async () => {
  const c = await verifyGoogleIdToken(mint(), [AUD], certs);
  assert.equal(c?.email, 'person@example.com');
  assert.equal(c?.uid, 'g-uid-1');
});

test('google mobile token: wrong audience, issuer, expiry, unverified email are rejected', async () => {
  assert.equal(await verifyGoogleIdToken(mint({ aud: 'other' }), [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken(mint({ iss: 'https://evil.example' }), [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken(mint({ exp: Math.floor(Date.now() / 1000) - 10 }), [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken(mint({ email_verified: false }), [AUD], certs), null);
});

test('google mobile token: forged signature, unknown kid, bad shape, no audiences configured -> null', async () => {
  execFileSync('openssl', ['genrsa', '-out', path.join(dir, 'k2.pem'), '2048'], { stdio: 'ignore' });
  const other = fs.readFileSync(path.join(dir, 'k2.pem'), 'utf8');
  assert.equal(await verifyGoogleIdToken(mint({}, other), [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken(mint({}, key, 'nope'), [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken('garbage', [AUD], certs), null);
  assert.equal(await verifyGoogleIdToken(mint(), [], certs), null);
});
