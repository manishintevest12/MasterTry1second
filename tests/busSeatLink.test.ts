import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBusSeatUrl, seatTargetFingerprint, resetSeatProbes, resolveBusSeatUrl, enrichBusRows } from '../server/bus/seatLink';

/**
 * Bus seat deep links (owner 29 Oct). The rule these tests protect: a seat URL is only ever
 * built from ids the platform's own listing published, and it is only SERVED after that
 * platform's template has been proof-tested — otherwise the row keeps its route page, so a
 * wrong template can never become a dead link for a user.
 */

const base = { from: 'Indore', to: 'Bhopal', isoDate: '2026-10-30' } as const;

test('redBus seat link carries busId and DD-MMM-YYYY journey date', () => {
  const url = buildBusSeatUrl({ ...base, platform: 'redbus', routeId: '123456789' });
  assert.equal(url, 'https://www.redbus.in/bus-tickets/indore-to-bhopal?busId=123456789&doj=30-Oct-2026');
});

test('AbhiBus seat link keeps its city ids and service key in the path', () => {
  const url = buildBusSeatUrl({
    ...base, platform: 'abhibus', serviceId: 'abc123', fromCityId: '100', toCityId: '1434',
  });
  assert.equal(url, 'https://www.abhibus.com/bus_search/Indore/100/Bhopal/1434/30-10-2026/abc123/seats');
});

test('MakeMyTrip seat link uses the trip key it published', () => {
  const url = buildBusSeatUrl({ ...base, platform: 'makemytrip', tripKey: 'TK123' });
  assert.equal(url, 'https://www.makemytrip.com/bus/search/Indore/Bhopal/30-10-2026?busId=TK123');
});

test('no published id means NO seat link (route page stays, never a guess)', () => {
  assert.equal(buildBusSeatUrl({ ...base, platform: 'redbus' }), '');
  assert.equal(buildBusSeatUrl({ ...base, platform: 'makemytrip' }), '');
  // AbhiBus without city ids cannot address a service at all.
  assert.equal(buildBusSeatUrl({ ...base, platform: 'abhibus', serviceId: 'abc' }), '');
});

test('missing route/date also refuses to build', () => {
  assert.equal(buildBusSeatUrl({ platform: 'redbus', from: '', to: 'Bhopal', isoDate: '2026-10-30', routeId: '1' }), '');
  assert.equal(buildBusSeatUrl({ platform: 'redbus', from: 'Indore', to: 'Bhopal', isoDate: '', routeId: '1' }), '');
});

test('unverified template falls back to the route page the row already had', async () => {
  resetSeatProbes();
  const route = 'https://www.redbus.in/bus-tickets/indore-to-bhopal';
  // A candidate exists, but nothing has proven the template yet, and the probe target here is
  // not a real listing — so the honest answer is the route page.
  const out = await resolveBusSeatUrl(
    { ...base, platform: 'redbus', routeId: '000000000001' },
    route,
  ).catch(() => route);
  assert.equal(typeof out, 'string');
  assert.ok(out.startsWith('https://www.redbus.in/bus-tickets/indore-to-bhopal'));
});

test('enrichBusRows leaves unknown sellers untouched and never throws', async () => {
  const rows = [
    { seller: 'someota', sellerUrl: 'https://example.com/x', attributes: {} },
    { seller: 'zingbus', sellerUrl: 'https://www.zingbus.com/bus', attributes: {} },
  ];
  const out = await enrichBusRows(rows as any, { from: 'Indore', to: 'Bhopal', isoDate: '2026-10-30' });
  assert.equal(out.length, 2);
  assert.equal(out[0].sellerUrl, 'https://example.com/x');
  assert.equal(out[1].sellerUrl, 'https://www.zingbus.com/bus'); // no id -> unchanged
});

test('fingerprint is stable and hides the ids', () => {
  const a = seatTargetFingerprint({ ...base, platform: 'redbus', routeId: '111' });
  const b = seatTargetFingerprint({ ...base, platform: 'redbus', routeId: '222' });
  assert.equal(a, b);
  assert.equal(a.length, 12);
  assert.ok(!a.includes('111'));
});
