import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseDominosMenu, dominosItems } from '../server/workers/parsers/dominos.ts';
import { unitPriceOf } from '../server/smartcart/basket.ts';
import { ekaroTrackingUrl } from '../server/affiliate/ekaro/index.ts';

// ---------------------------------------------------------------------------
// 1. Smart Cart price mapping (owner bug 22 Oct): normalized offers carry
//    prices.effectivePrice/mandatoryTotal, NOT prices.price.
// ---------------------------------------------------------------------------
test('unitPriceOf reads effectivePrice/mandatoryTotal/finalPayablePrice, not the absent price field', () => {
  assert.equal(unitPriceOf({ prices: { effectivePrice: 70, mandatoryTotal: 80 } }), 70);
  assert.equal(unitPriceOf({ prices: { mandatoryTotal: 42 } }), 42);
  assert.equal(unitPriceOf({ prices: { finalPayablePrice: 31.5 } }), 31.5);
  // the bug shape: prices.price alone must never be required
  assert.equal(unitPriceOf({ prices: { price: 99 } }), 99, 'legacy price field still honored if present');
  assert.equal(unitPriceOf({ prices: {} }), 0);
  assert.equal(unitPriceOf(null), 0);
});

// A pre-fix offer shape proves the filter would have dropped everything.
test('cart filter keeps grocery offers with effectivePrice (old code dropped all)', () => {
  const offers = [
    { seller: 'Blinkit', prices: { effectivePrice: 70, mandatoryTotal: 70 } },
    { seller: 'Zepto', prices: { mandatoryTotal: 20 } },
    { seller: 'NoPrice', prices: { warnings: ['x'] } },
  ];
  const kept = offers.filter((o) => unitPriceOf(o) > 0 && o.seller);
  assert.equal(kept.length, 2);
});

// ---------------------------------------------------------------------------
// 2. Domino's food images (owner bug 22 Oct): product cards must show the real
//    dish photo from images.dominos.co.in (mediaList sits past the price window).
// ---------------------------------------------------------------------------
const ent = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function dominosBlob(uid: string, name: string, family: string, mediaPath: string | null, price = 99) {
  const media = mediaPath
    ? `,"mediaList":[{"mediaId":"m-${uid}","altText":"No Image","mediaType":"IMAGE","mediaUrls":{"HomeProductV1":"${mediaPath}","menu":"Dominos/menu/${mediaPath}"},"default":true}]`
    : '';
  return ent(
    `{"productMasterUID":"${uid}","name":"${name}","displayName":"${name}","family":{"familyId":"e1e2e3e4-1111-2222-3333-44445555aaaa","name":"${family}"},"description":"desc"${media},"price":{"regularPrice":149,"currentPrice":${price}}}`,
  );
}

test('parseDominosMenu extracts real product photos (HomeProductV1 preferred)', () => {
  const html = [
    dominosBlob('a1b2c3d4-1111-2222-3333-444455556666', 'Margherita', 'Pizza', 'Dominos/HomeProductV1/marg.webp'),
    dominosBlob('a1b2c3d4-1111-2222-3333-444455557777', 'Farmhouse', 'Pizza', 'Dominos/HomeProductV1/farm.webp'),
  ].join('');
  const products = parseDominosMenu(html);
  assert.equal(products.length, 2);
  assert.ok(products[0].image!.startsWith('https://images.dominos.co.in/nextgen-catalog/media/prod/Dominos/'));
  assert.ok(products[0].image!.endsWith('marg.webp'));
  assert.ok(products[1].image!.includes('farm.webp'));
});

test('dominosItems carries the image into raw item attributes', () => {
  const html = dominosBlob('b1b2c3d4-1111-2222-3333-444455558888', 'Peppy Paneer', 'Pizza', 'Dominos/HomeProductV1/peppy.webp');
  const items = dominosItems(parseDominosMenu(html), { id: 'w_food_dominos', name: "Domino's" } as any, 'peppy paneer');
  assert.equal(items.length, 1);
  assert.equal(items[0].attributes!.image, 'https://images.dominos.co.in/nextgen-catalog/media/prod/Dominos/HomeProductV1/peppy.webp');
});

test('products without mediaList keep an honest empty image (never a logo)', () => {
  const html = dominosBlob('c1b2c3d4-1111-2222-3333-444455559999', 'Corn', 'Pizza', null);
  const products = parseDominosMenu(html);
  assert.equal(products.length, 1);
  assert.equal(products[0].image, '');
});

// mediaList past the 4000-char price window still maps to the right product
test('mediaList past the price window is attributed to its own product', () => {
  // simple deterministic long filler inside the blob before mediaList
  const longFiller = `,"filler":"${'a'.repeat(6000)}"`;
  const blob = (uid: string, name: string, media: string | null) =>
    ent(`{"productMasterUID":"${uid}","name":"${name}","displayName":"${name}","family":{"familyId":"e1e2e3e4-1111-2222-3333-444455551234","name":"Pizza"},"description":"d"${longFiller}${media ? `,"mediaList":[{"mediaId":"m","altText":"No Image","mediaType":"IMAGE","mediaUrls":{"HomeProductV1":"Dominos/HomeProductV1/${name}.webp"},"default":true}]` : ''},"price":{"regularPrice":149,"currentPrice":99}}`);
  const html = blob('d1b2c3d4-1111-2222-3333-44445555aaaa', 'Veggie', 'Dominos/HomeProductV1/veggie.webp') + blob('d1b2c3d4-1111-2222-3333-44445555bbbb', 'Cheese', null);
  const products = parseDominosMenu(html);
  assert.equal(products.length, 2);
  assert.ok(products[0].image!.endsWith('Veggie.webp'), 'first product keeps its far-away mediaList');
  assert.equal(products[1].image, '', 'second product does not steal the previous mediaList');
});

// ---------------------------------------------------------------------------
// 3. Ekaro converter layer (owner rule 22 Oct): last fallback before direct.
// ---------------------------------------------------------------------------
test('ekaroTrackingUrl returns null without EKARO_API_KEY (honest direct hop)', async () => {
  delete process.env.EKARO_API_KEY;
  assert.equal(await ekaroTrackingUrl('https://blinkit.com/s/?q=milk'), null);
});

test('ekaroTrackingUrl converts a retailer deeplink when the API answers', async () => {
  const prev = process.env.EKARO_API_KEY;
  const realFetch = globalThis.fetch;
  process.env.EKARO_API_KEY = 'test-key';
  let called = 0;
  globalThis.fetch = (async (u: any, opts: any) => {
    called += 1;
    // Live-verified 22 Oct: POST /api/converter, body {deal, convert_option}.
    assert.equal(String(u), 'https://ekaro-api.affiliaters.in/api/converter');
    assert.equal((opts.headers as any).authorization, 'Bearer test-key');
    const body = JSON.parse(String(opts.body));
    assert.equal(body.deal, 'https://blinkit.com/s/?q=milk&fresh=1');
    assert.equal(body.convert_option, 'convert_only');
    // Real response shape: deal text with the profit link REPLACED IN PLACE
    // (observed live: Flipkart -> https://fktr.in/W6Zsh2S, success:1 + randomPostID).
    return { ok: true, status: 200, json: async () => ({ success: 1, data: 'https://fktr.in/W6Zsh2S', randomPostID: 'ibDMuHX' }) } as any;
  }) as any;
  const link = await ekaroTrackingUrl('https://blinkit.com/s/?q=milk&fresh=1');
  assert.equal(link, 'https://fktr.in/W6Zsh2S');
  // domain cache: second call must not hit the API again
  await ekaroTrackingUrl('https://blinkit.com/s/?q=bread');
  assert.equal(called, 1);
  globalThis.fetch = realFetch;
  if (prev === undefined) delete process.env.EKARO_API_KEY; else process.env.EKARO_API_KEY = prev;
});

test('ekaroTrackingUrl self-heals on 401 (falls back to null, caches negative)', async () => {
  const prev = process.env.EKARO_API_KEY;
  const realFetch = globalThis.fetch;
  process.env.EKARO_API_KEY = 'bad-key';
  globalThis.fetch = (async () => ({ ok: false, status: 401, json: async () => ({ error: 1 }) }) as any)();
  globalThis.fetch = (async () => ({ ok: false, status: 401, json: async () => ({ error: 1 }) })) as any;
  assert.equal(await ekaroTrackingUrl('https://zepto.com/search?query=milk'), null);
  assert.equal(await ekaroTrackingUrl('https://zepto.com/search?query=atta'), null, 'negative cache: no second call');
  globalThis.fetch = realFetch;
  if (prev === undefined) delete process.env.EKARO_API_KEY; else process.env.EKARO_API_KEY = prev;
});
