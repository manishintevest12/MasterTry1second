import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextProxy, noteProxyResult, proxyPoolStatus, rotationEnabled,
  resetRotationForTests, rotationTries, rotationPoolSize,
} from '../server/common/proxyRotator';

const ENV = { ...process.env };
beforeEach(() => { resetRotationForTests(); process.env = { ...ENV }; });
afterEach(() => { process.env = { ...ENV }; resetRotationForTests(); });

test('rotation is off when no legs are configured, so behaviour is unchanged', () => {
  delete process.env.T1S_PROXY_LIST;
  assert.equal(rotationEnabled(), false);
  assert.equal(rotationPoolSize(), 0);
  assert.equal(nextProxy(), null);
});

test('parses a mixed list, accepts host:port shorthand and drops junk + duplicates', () => {
  process.env.T1S_PROXY_LIST = 'http://u:p@1.2.3.4:8000, 5.6.7.8:3128 junk socks5://9.9.9.9:1080 http://u:p@1.2.3.4:8000';
  assert.equal(rotationPoolSize(), 3);
  assert.equal(rotationEnabled(), true);
});

test('never exposes proxy passwords in the admin view', () => {
  process.env.T1S_PROXY_LIST = 'http://user:supersecret@1.2.3.4:8000';
  assert.ok(!JSON.stringify(proxyPoolStatus()).includes('supersecret'));
});

test('rotates round-robin so one exit is not hammered', () => {
  process.env.T1S_PROXY_LIST = 'http://a.test:1 http://b.test:2 http://c.test:3';
  const picked = [nextProxy(), nextProxy(), nextProxy()].map((l) => l!.label);
  assert.equal(new Set(picked).size, 3);
});

test('skips a leg already tried for the same request', () => {
  process.env.T1S_PROXY_LIST = 'http://a.test:1 http://b.test:2';
  const first = nextProxy()!;
  const second = nextProxy(new Set([first.url]))!;
  assert.notEqual(second.url, first.url);
});

test('parks a gated leg and revives it after a success', () => {
  process.env.T1S_PROXY_LIST = 'http://a.test:1';
  const leg = nextProxy()!;
  noteProxyResult(leg.url, { ok: false, status: 403, gated: true });
  assert.equal(proxyPoolStatus().parked, 1);
  noteProxyResult(leg.url, { ok: true, status: 200 });
  assert.equal(proxyPoolStatus().parked, 0);
  assert.equal(proxyPoolStatus().legs[0].ok, 1);
});

test('still answers from the least-parked leg when every leg is parked', () => {
  process.env.T1S_PROXY_LIST = 'http://a.test:1 http://b.test:2';
  for (const leg of [nextProxy()!, nextProxy()!]) {
    noteProxyResult(leg.url, { ok: false, status: 429, gated: true });
  }
  assert.equal(proxyPoolStatus().parked, 2);
  assert.notEqual(nextProxy(), null);
});

test('honours the kill switch and clamps the retry budget', () => {
  process.env.T1S_PROXY_LIST = 'http://a.test:1';
  process.env.T1S_PROXY_DISABLE = '1';
  assert.equal(rotationEnabled(), false);
  delete process.env.T1S_PROXY_DISABLE;
  process.env.T1S_PROXY_TRIES = '99';
  assert.equal(rotationTries(), 6);
  process.env.T1S_PROXY_TRIES = '-3';
  assert.equal(rotationTries(), 0);
  delete process.env.T1S_PROXY_TRIES;
  assert.equal(rotationTries(), 2);
});
