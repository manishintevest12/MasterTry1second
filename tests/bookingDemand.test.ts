/**
 * OWNER 10 Nov: "booking.com ka demand api generate kro".
 * Demand API access is a Managed Affiliate Partner approval - Booking.com issues the token, nobody can
 * generate one. These tests pin the honest behaviour: configured -> real request shape, not configured ->
 * a clear CAPABILITY_UNAVAILABLE, and never a price-less row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingDemandConfigured, bookingDemandConfig, bookingDemandSearch, bookingDemandItems } from '../server/workers/parsers/bookingDemand';

test('unconfigured is a known state, not an empty result', async () => {
  delete process.env.BOOKING_DEMAND_AFFILIATE_ID;
  delete process.env.BOOKING_DEMAND_TOKEN;
  assert.equal(bookingDemandConfigured(), false);
  await assert.rejects(() => bookingDemandSearch({}), /BOOKING_DEMAND_NOT_CONFIGURED/);
});

test('configured sends X-Affiliate-Id + bearer token to the search endpoint', async () => {
  process.env.BOOKING_DEMAND_AFFILIATE_ID = 'aff-123';
  process.env.BOOKING_DEMAND_TOKEN = 'tok-abc';
  process.env.BOOKING_DEMAND_API_BASE = 'https://demandapi.booking.com/3.3/';
  try {
    assert.equal(bookingDemandConfig()!.base, 'https://demandapi.booking.com/3.3', 'trailing slash trimmed');
    let seen: any = null;
    const fakeFetch = async (url: any, init: any) => {
      seen = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ data: { accommodations: [] } }) } as any;
    };
    await bookingDemandSearch({ checkin: '2026-11-20' }, fakeFetch as any);
    assert.match(seen.url, /\/accommodations\/search$/);
    assert.equal(seen.headers['X-Affiliate-Id'], 'aff-123');
    assert.equal(seen.headers.Authorization, 'Bearer tok-abc');
    assert.equal(seen.body.checkin, '2026-11-20');
  } finally {
    delete process.env.BOOKING_DEMAND_AFFILIATE_ID;
    delete process.env.BOOKING_DEMAND_TOKEN;
    delete process.env.BOOKING_DEMAND_API_BASE;
  }
});

test('rows without a positive price are dropped (No Price, No Card)', () => {
  const payload = {
    data: {
      accommodations: [
        { name: 'Priced Hotel', price: { book: { amount: 4200, currency: 'INR' } }, url: 'https://www.booking.com/hotel/in/x.html' },
        { name: 'No Price Hotel', price: { book: { amount: 0 } } },
        { name: 'Zero Hotel', price: {} },
        { price: { book: { amount: 999 } } }, // no name
      ],
    },
  };
  const items = bookingDemandItems(payload, { checkin: '2026-11-20', checkout: '2026-11-22' });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Priced Hotel');
  assert.equal(items[0].price, 4200);
  assert.equal(items[0].provider, 'Booking.com');
});

test('a garbage payload yields nothing rather than an error', () => {
  assert.deepEqual(bookingDemandItems(null), []);
  assert.deepEqual(bookingDemandItems({ data: { accommodations: 'nope' } }), []);
});
