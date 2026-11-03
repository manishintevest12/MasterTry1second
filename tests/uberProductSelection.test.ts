/**
 * OWNER 3 Nov: pasted Uber's live pricing endpoint + payload (/go/product-selection, MANUAL_PIN
 * pickup/drop, requestTime 0, sid cookie, curl_cffi impersonation). These tests pin the parts that
 * must hold in engine code: the payload we send is byte-for-byte his shape, his response shape is
 * parsed into real fares, the Apollo shape still works, and nothing without a positive number ever
 * becomes a price.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUberProductSelectionBody,
  parseUberProductSelectionResponse,
} from '../server/workers/parsers/uberGoProducts';
import { uberCsrfToken } from '../server/workers/verticals/cab';

test('Product Selection payload is exactly the owner-captured rider-session shape', () => {
  const body = JSON.parse(buildUberProductSelectionBody(
    { lat: 23.276699, lng: 77.4007089, name: 'pickup' },
    { lat: 23.2913247, lng: 77.3359114, name: 'drop' },
  ));
  assert.deepEqual(body, {
    pickup: { latitude: 23.276699, longitude: 77.4007089, source: 'MANUAL_PIN' },
    drop: [{ latitude: 23.2913247, longitude: 77.3359114, source: 'MANUAL_PIN' }],
    requestTime: 0,
  });
});

test('rider-session response: displayName + fareString + etaString become real priced products', () => {
  const body = JSON.stringify({
    data: {
      products: [
        { displayName: 'Uber Go', fareString: '₹374.01', etaString: '5 min' },
        { displayName: 'Premier', fareString: '₹512', etaString: '7 min' },
        { displayName: 'Auto', fareString: '₹110-130', etaString: '3 min' },
      ],
    },
  });
  const out = parseUberProductSelectionResponse(body);
  assert.equal(out.length, 3);
  assert.equal(out[0].displayName, 'Uber Go');
  assert.equal(out[0].fare, 374, 'single fareString -> rounded rupees');
  assert.equal(out[0].etaMinutes, 5);
  assert.equal(out[2].fare, 120, 'a range takes its midpoint, never a made-up bound');
});

test('a product with no positive number stays unpriced instead of being estimated', () => {
  const out = parseUberProductSelectionResponse(JSON.stringify({ data: { products: [
    { displayName: 'Moto', fareString: 'Metered', etaString: '' },
    { displayName: 'Uber Go', fareString: '', etaString: '4 min' },
  ] } }));
  assert.equal(out.length, 2);
  assert.equal(out[0].fare, null);
  assert.equal(out[1].fare, null);
  assert.equal(out[1].etaMinutes, 4);
});

test('the Apollo products{tiers} shape still routes through the existing parser', () => {
  const out = parseUberProductSelectionResponse(JSON.stringify({ data: { products: { tiers: [
    { title: 'Recommended', products: [{ displayName: 'Uber Go', isAvailable: true, fares: [{ fare: '₹210', capacity: 4 }], etaInMin: 3 }] },
  ] } } }));
  assert.equal(out.length, 1);
  assert.equal(out[0].displayName, 'Uber Go');
  assert.equal(out[0].fare, 210);
});

test('csrf token comes from the pasted session jar, else hPanel, else Uber\'s own literal x', () => {
  assert.equal(uberCsrfToken({ 'XSRF-TOKEN': 'abc%3D' }), 'abc=');
  const prev = process.env.UBER_CSRF_TOKEN;
  delete process.env.UBER_CSRF_TOKEN;
  assert.equal(uberCsrfToken({ sid: 'only' }), 'x');
  process.env.UBER_CSRF_TOKEN = 'envtok';
  assert.equal(uberCsrfToken({}), 'envtok');
  if (prev === undefined) delete process.env.UBER_CSRF_TOKEN; else process.env.UBER_CSRF_TOKEN = prev;
});
