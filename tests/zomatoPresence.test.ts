/**
 * Zomato worker v2 (owner 23 Oct: Zomato must ALWAYS be represented in food
 * results). Akamai's edge gates datacenter listing crawls (403/202 sampled).
 * Regression tests:
 *   1. hard-gated edge -> honest presence row (app_only_fares handoff, never
 *      a silent Zomato disappearance from the app).
 *   2. sampling edge (403 then 200) -> real listings win, no presence row.
 *   3. challenge shell on a 200 -> presence row, no invented data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foodWorker } from '../server/workers/verticals/food';
import { readFileSync } from 'node:fs';

const ORDER_FIXTURE = readFileSync(new URL('./fixtures/zomato-order-page.html', import.meta.url), 'utf8');

const SRC = { id: 'w_food_zomato', name: 'Zomato', targetSite: 'https://www.zomato.com', adapter: 'http' } as any;

const zomatoTask = () => {
  const t = (foodWorker as any).tasks.find((x: any) => x.sourceId === 'w_food_zomato');
  assert.ok(t, 'w_food_zomato task registered in food worker');
  return t;
};

const mkCtx = (fetch: any, term = 'pizza') => ({
  query: { rawQuery: term, entityName: term, location: { city: 'Indore', pincode: '452001' } },
  source: SRC,
  fetch,
});

test('zomato: hard-gated edge (403 x3) falls back to ONE honest presence row with app_only_fares', async () => {
  const calls: string[] = [];
  const ctx = mkCtx(async (url: string) => { calls.push(url); return { status: 403, body: '<HTML>Access Denied</HTML>', ok: false, latencyMs: 10 }; });
  const rows = await zomatoTask().run(ctx);
  assert.equal(calls.length, 3, '3 bounded sampling attempts');
  assert.equal(rows.length, 1);
  const r: any = rows[0];
  assert.equal(r.seller, 'Zomato');
  assert.ok(String(r.sellerUrl).startsWith('https://www.zomato.com/indore/restaurants?q=pizza'), 'deeplink is the real Zomato search URL');
  assert.equal(r.attributes!.price_basis, 'app_only_fares', 'validation-passing unverified fare basis');
  assert.equal(r.price, undefined, 'no invented price');
});

test('zomato: sampling edge (403 then 200) returns real listings, no presence row', async () => {
  let n = 0;
  const fetch = async (url: string) => {
    n += 1;
    if (n === 1) return { status: 403, body: '<HTML>Access Denied</HTML>', ok: false, latencyMs: 10 };
    // Second fetch: the listing page (JSON-LD ItemList, the parser's real shape);
    // menu deep-dive fetches answer non-200 and are skipped.
    const ld = { '@type': 'ItemList', itemListElement: [
      { item: { name: 'Olio Wood Fired Pizzeria', url: '/indore/olio-wood-fired-pizzeria-vijay-nagar',
        servesCuisine: 'Pizza, Italian', aggregateRating: { ratingValue: 4.4, reviewCount: 210 },
        address: { streetAddress: 'Vijay Nagar, Indore' } } },
      { item: { name: "Domino's Pizza Vijay Nagar", url: '/indore/dominos-pizza-vijay-nagar',
        servesCuisine: 'Pizza', aggregateRating: { ratingValue: 3.9, reviewCount: 840 } } },
    ] };
    if (url.includes('/order')) return { status: 200, body: ORDER_FIXTURE, ok: true, latencyMs: 20 };
    return { status: 200, body: `<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`, ok: true, latencyMs: 20 };
  };
  const ctx = mkCtx(fetch, 'thali');
  const rows = await zomatoTask().run(ctx);
  assert.ok(rows.length > 0, 'priced dishes returned from the menu deep-dive');
  assert.ok(rows.every((r: any) => (r.attributes!.price_basis || '') !== 'app_only_fares'), 'no presence contamination when listings work');
  assert.ok(rows.every((r: any) => r.attributes!.price_basis !== 'app_only_fares' || r.seller === 'Zomato'), 'no presence contamination');
});

test('zomato: 200 challenge shell falls back to the presence row', async () => {
  const ctx = mkCtx(async () => ({ status: 200, body: '<html><title>Just a moment...</title>Enable JavaScript and cookies to continue</html>', ok: true, latencyMs: 10 }));
  const rows = await zomatoTask().run(ctx);
  assert.equal(rows.length, 1);
  const r: any = rows[0];
  assert.equal(r.attributes!.price_basis, 'app_only_fares');
  assert.ok(/challenge/.test(String(r.attributes!.data_note)), 'reason recorded honestly');
});
