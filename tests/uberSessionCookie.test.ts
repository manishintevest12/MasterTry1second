/**
 * Uber session cookie (owner 30 Oct: "open source add kro github se jo uber ka price
 * real time").
 *
 * The open-source finding: no anonymous Uber ride price exists; the two working OSS
 * projects (jgalea/uber-cli, Emerson1337/CanIGetHome) send the rider's OWN session
 * cookie to POST m.uber.com/go/graphql. These tests pin the cookie parsing that makes
 * that usable from an env var, in all the shapes an owner will realistically paste.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseUberSessionCookie } from '../server/workers/verticals/cab';

test('a full cookie header keeps every pair', () => {
  const c = parseUberSessionCookie('sid=abc123; jwt-session=eyJhbGciOi.payload.sig; __cf_bm=x.y');
  assert.equal(c.sid, 'abc123');
  assert.equal(c['jwt-session'], 'eyJhbGciOi.payload.sig');
  assert.equal(c.__cf_bm, 'x.y');
});

test('a bare sid value is accepted', () => {
  const c = parseUberSessionCookie('  abc123.def-456  ');
  assert.deepEqual(c, { sid: 'abc123.def-456' });
});

test('newlines and commas from a copied devtools panel work', () => {
  const c = parseUberSessionCookie('sid=abc\njwt-session=def\nother=ghi');
  assert.equal(c.sid, 'abc');
  assert.equal(c['jwt-session'], 'def');
  assert.equal(c.other, 'ghi');
});

test('nothing configured means no cookies (guest path stays in charge)', () => {
  assert.deepEqual(parseUberSessionCookie(''), {});
  assert.deepEqual(parseUberSessionCookie(undefined), {});
  assert.deepEqual(parseUberSessionCookie(null), {});
});

test('malformed fragments never invent a cookie', () => {
  const c = parseUberSessionCookie('===; sid=; good=1');
  assert.equal(c.good, '1');
  assert.equal(c.sid, undefined);
});
