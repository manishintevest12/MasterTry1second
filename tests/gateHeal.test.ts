import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gateKeyFor, GATE_TARGETS, healGatedSource, autoHealGatedSources } from '../server/common/gateHeal';
import { readDiscoveredPool } from '../server/common/proxyDiscovery';

/**
 * Owner 2 Nov: "indigo abhi v baki hai isko fix kro kaise v". IndiGo's mobile fare API is
 * Akamai-gated for datacenter IPs; the rotator can route around it, but data/proxy-pool.json
 * was empty so no leg ever existed. These tests pin the self-heal contract: a gated source
 * sweeps ONLY public proxies that pass its own gated request, stores them in the gated pool,
 * and never runs more often than the cooldown.
 */
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gateheal-'));

test('the IndiGo heal target is the real gated request, not a neutral probe', () => {
  const t = GATE_TARGETS.indigo;
  assert.ok(t, 'indigo target must exist');
  assert.match(t.url, /api-prod-mobile-skyplus6e\.goindigo\.in\/flightsearch\/v1\/flight\/search$/);
  assert.equal(t.method, 'POST');
  assert.ok(t.headers?.user_key, 'the static app user_key the public APK ships is required');
  const body = JSON.parse(String(t.body));
  assert.equal(body.tripType, 'ONE_WAY');
  assert.equal(body.currencyCode, 'INR');
  assert.deepEqual(body.criteria[0].stations.originStationCodes, ['IDR']);
  assert.deepEqual(body.criteria[0].stations.destinationStationCodes, ['DEL']);
  assert.ok((t.maxMs || 0) >= 2000, 'a partner search is slower than the 500ms ipify budget');
});

test('a gated source is recognised from its worker id or its error message', () => {
  assert.equal(gateKeyFor('w_flights_indigo'), 'indigo');
  assert.equal(gateKeyFor('w_flights_ixigo', 'IndiGo 6E blocked'), 'indigo');
  assert.equal(gateKeyFor('w_flights_cleartrip', 'ACCESS_CHALLENGE'), null);
});

test('a sweep stores only the hops that passed the gated request', async () => {
  const dir = tmp();
  const poolFile = path.join(dir, 'gated.json');
  const stateFile = path.join(dir, 'state.json');
  let seenTarget: any = null;
  const fakeDiscover: any = async (opts: any) => {
    seenTarget = opts.target;
    return { probed: 12, kept: [{ url: 'http://1.2.3.4:8080', ok: true, ms: 3100, status: 200, reason: 'ok' }], passed: 1 };
  };
  const res = await healGatedSource('indigo', { force: true, discover: fakeDiscover, poolFile, stateFile });
  assert.equal(res.ran, true);
  assert.equal(res.kept, 1);
  assert.equal(res.tried, 12);
  assert.match(res.reason, /1 proxy hop\(s\) pass indigo-mobile-search/);
  // The sweep must be pointed at the gated request, and must write to its own pool file.
  assert.equal(seenTarget.url, GATE_TARGETS.indigo.url);
  assert.equal(seenTarget.method, 'POST');
  assert.ok(fs.existsSync(stateFile), 'the cooldown clock is persisted');
});

test('the cooldown blocks a second sweep of the same source', async () => {
  const dir = tmp();
  const poolFile = path.join(dir, 'gated.json');
  const stateFile = path.join(dir, 'state.json');
  let calls = 0;
  const fakeDiscover: any = async () => { calls++; return { probed: 3, kept: [], passed: 0 }; };
  const t0 = Date.now();
  await healGatedSource('indigo', { discover: fakeDiscover, poolFile, stateFile, now: () => t0 });
  const second = await healGatedSource('indigo', { discover: fakeDiscover, poolFile, stateFile, now: () => t0 + 5_000 });
  assert.equal(calls, 1, 'no second sweep inside the cooldown');
  assert.equal(second.ran, false);
  assert.match(second.reason, /cooling down/);
});

test('a sweep that finds nothing says so honestly', async () => {
  const dir = tmp();
  const res = await healGatedSource('indigo', {
    force: true,
    discover: (async () => ({ probed: 40, kept: [], passed: 0 })) as any,
    poolFile: path.join(dir, 'gated.json'),
    stateFile: path.join(dir, 'state.json'),
  });
  assert.equal(res.ran, true);
  assert.equal(res.kept, 0);
  assert.match(res.reason, /no candidate passed/);
});

test('an unknown source is never healed', async () => {
  const res = await healGatedSource('makemytrip', { force: true });
  assert.equal(res.ran, false);
  assert.match(res.reason, /no heal target/);
});

test('a failing sweep never throws (search must not break)', async () => {
  const dir = tmp();
  const res = await healGatedSource('indigo', {
    force: true,
    discover: (async () => { throw new Error('list source down'); }) as any,
    poolFile: path.join(dir, 'gated.json'),
    stateFile: path.join(dir, 'state.json'),
  });
  assert.equal(res.ran, true);
  assert.match(res.reason, /sweep failed: list source down/);
});

test('autoHealGatedSources heals each gated key once and swallows errors', async () => {
  const healed: string[] = [];
  const out = await autoHealGatedSources(
    [
      { source: 'w_flights_indigo', message: 'ACCESS_CHALLENGE' },
      { source: 'w_flights_indigo', message: 'Akamai 403' },
      { source: 'w_flights_cleartrip', message: 'HTTP 429' },
    ],
    { heal: (async (k: string) => { healed.push(k); return { source: k, ran: true, reason: 'ok', tried: 1, kept: 1 }; }) as any },
  );
  assert.deepEqual(healed, ['indigo'], 'one heal per distinct gated source');
  assert.equal(out.length, 1);
  // No gated source -> nothing happens at all.
  assert.deepEqual(await autoHealGatedSources([{ source: 'w_hotels_yatra', message: 'HTTP 500' }]), []);
});

test('the rotator reads the gated pool with a wider ceiling', () => {
  // Empty by default in the repo, but the reader must exist and never throw.
  const pool = readDiscoveredPool();
  assert.ok(Array.isArray(pool));
});
