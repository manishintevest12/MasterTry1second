/**
 * Singapore Airlines regression (24 Oct 2026): AI Flight Finder fare cache.
 * Fixture recorded LIVE 24 Oct 2026 via in-page fetch replay (cold random
 * uuid session): POST /ai-mode/api/chat -> SSE stream with inline
 * getFareCache tool output: BOM->SIN 30 Oct 2026 economy INR 43,427 with a
 * ready booking deeplink (externalFlightSearch.form + checkSum).
 * Guards: SSE tool-output parsing (date-level fares), route-invalid
 * honesty, Akamai gate signatures, request body shape, item parity fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SIA_CHAT_API, siaChatBody, siaChatPrompt, parseSiaChatStream, siaRouteInvalid, siaIsGated, siaFareItems } from '../server/workers/parsers/singaporeAirChat.ts';

const src: any = { id: 't_flights_sia', name: 'Singapore Airlines', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };
const SSE = readFileSync(new URL('./fixtures/sia_chat_bom_sin_sse.txt', import.meta.url), 'utf8');

test('siaChatBody + siaChatPrompt replay the exact CDP-captured shape', () => {
  const body = JSON.parse(siaChatBody(siaChatPrompt('BOM', 'SIN', '2026-10-30', '30 October 2026'), () => '9f68c06b-78ba-4567-8557-41cc7c117441'));
  assert.equal(body.message.role, 'user');
  assert.equal(body.message.parts[0].type, 'text');
  assert.ok(body.message.parts[0].text.includes('BOM'));
  assert.ok(body.message.parts[0].text.includes('SIN'));
  assert.ok(body.message.parts[0].text.includes('2026-10-30'));
  assert.ok(body.message.parts[0].text.includes('30 October 2026'));
  assert.ok(typeof body.id === 'string' && body.id.length > 10);
  assert.equal(SIA_CHAT_API, 'https://www.singaporeair.com/ai-mode/api/chat');
});

test('parseSiaChatStream decodes the live getFareCache fare row', () => {
  const rows = parseSiaChatStream(SSE);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.origin, 'BOM');
  assert.equal(r.destination, 'SIN');
  assert.equal(r.cabin, 'Y');
  assert.equal(r.tripType, 'O');
  assert.equal(r.currency, 'INR');
  assert.equal(r.departureDate, '2026-10-30');
  assert.equal(r.fare, 43427);
  assert.ok(r.redirectionUrl.includes('externalFlightSearch.form'));
  assert.ok(r.redirectionUrl.includes('origin=BOM'));
  assert.ok(r.redirectionUrl.includes('destination=SIN'));
  assert.ok(r.redirectionUrl.includes('checkSum='));
});

test('parseSiaChatStream tolerates garbage and empty input', () => {
  assert.deepEqual(parseSiaChatStream(''), []);
  assert.deepEqual(parseSiaChatStream('data: {"type":"text-delta"}\n\ndata: not-json'), []);
});

test('siaRouteInvalid: valid route on the live fixture stays false', () => {
  assert.equal(siaRouteInvalid(SSE), false);
});

test('siaIsGated: Akamai signatures detected, live stream not gated', () => {
  assert.equal(siaIsGated(403, 'Access Denied'), true);
  assert.equal(siaIsGated(403, '<HTML><HEAD><TITLE>Access Denied</TITLE>'), true);
  assert.equal(siaIsGated(200, SSE), false);
  assert.equal(siaIsGated(429, ''), true);
});

test('siaFareItems: honest date-level row with booking deeplink + cache caveat', () => {
  const rows = parseSiaChatStream(SSE);
  const items = siaFareItems(rows, src, 'Mumbai', 'Singapore', '2026-10-30');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.seller, 'Singapore Airlines');
  assert.equal(it.currency, 'INR');
  assert.equal(it.price, 43427);
  assert.equal(it.attributes.travel_date, '2026-10-30');
  assert.equal(it.attributes.departure_date, '2026-10-30');
  assert.equal(it.attributes.airline, 'Singapore Airlines');
  assert.ok(it.title.includes('Singapore Airlines'));
  assert.ok(it.sellerUrl.includes('externalFlightSearch.form'));
  assert.ok(it.attributes.data_note.includes('fare cache'));
  assert.ok(it.attributes.data_note.includes('4 days'));
  assert.equal(it.travel.date, '2026-10-30');
});

test('siaFareItems: other-date fares are excluded (exact-date honesty)', () => {
  const rows = parseSiaChatStream(SSE);
  assert.equal(siaFareItems(rows, src, 'Mumbai', 'Singapore', '2026-10-31').length, 0);
});
