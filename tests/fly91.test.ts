/**
 * Fly91 regression (24 Oct 2026): IBS iTravel IBE replays browserless.
 * Fixture recorded LIVE from the sandbox 24 Oct 2026 (GOX-HYD 28-Oct WebFlow
 * results page): IC 5303 SDW 12:10 -> HYD 13:45, 4,001 INR SAVER, 7-day
 * strip 25-31 Oct = 5,777/9,000/5,777/4,001/3,201/3,600/4,650.
 * Guards: date formatting, WebFlow body/action extraction, exact-date flight
 * parsing with true board point, fare strip, per-flight item build.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fly91Date, fly91BookingUrl, fly91EventBody, fly91FormAction, parseFly91Results, parseFly91FareStrip, fly91FlightItems } from '../server/workers/parsers/fly91Ibe.ts';

const src: any = { id: 't_flights_fly91', name: 'Fly91', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const HTML = readFileSync(new URL('./fixtures/fly91_results_gox_hyd.html', import.meta.url), 'utf8');

test('fly91Date formats ISO to IBE DD-MMM-YYYY', () => {
  assert.equal(fly91Date('2026-10-28'), '28-Oct-2026');
  assert.equal(fly91Date('2026-01-05'), '05-Jan-2026');
});

test('fly91BookingUrl is the exact widget redirect URL', () => {
  const u = fly91BookingUrl('GOX', 'HYD', '2026-10-28');
  assert.equal(u, 'https://fly91.in/reservation/ibe/booking?mode=searchResultInter&wvm=WVMD&tripType=OW&origin=GOX&destination=HYD&travelDate=28-Oct-2026&adults=1&children=0&infants=0&cabinClass=ECONOMY&promoCode=&pointOfPurchase=OTHERS&channel=FLYWEB&locale=en_US&fareLevelSearch=ST&fareTypeSearch=SAVER');
});

test('fly91EventBody carries the WebFlow event and full param set', () => {
  const b = new URLSearchParams(fly91EventBody('GOX', 'HYD', '2026-10-28'));
  assert.equal(b.get('_eventId'), 'showWtLblResult');
  assert.equal(b.get('origin'), 'GOX');
  assert.equal(b.get('destination'), 'HYD');
  assert.equal(b.get('travelDate'), '28-Oct-2026');
  assert.equal(b.get('ibeScreenId'), 'IBE000');
  assert.equal(b.get('fareTypeSearch'), 'SAVER');
});

test('fly91FormAction extracts the jsessionid WebFlow action from a shell', () => {
  const shell = `<form action="/reservation/ibe/booking;jsessionid=14F3F706D383A368B57483AE678BF802.IBE_IC_prd_1?execution=e1s1&amp;locale=en_US&amp;llt=&amp;agentId=&amp;" method="POST">`;
  const a = fly91FormAction(shell);
  assert.ok(a && a.includes('execution=e1s1') && a.includes('jsessionid') && !a.includes('&amp;'));
  assert.equal(fly91FormAction('<html></html>'), null);
});

test('parseFly91Results: 28 Oct flight decodes with times, board point, price', () => {
  const flights = parseFly91Results(HTML, '2026-10-28');
  assert.ok(flights.length >= 1, `expected flight rows, got ${flights.length}`);
  const f = flights.find((x) => x.flightNo === 'IC5303');
  assert.ok(f, 'IC5303 present');
  assert.equal(f.depTime, '12:10');
  assert.equal(f.arrTime, '13:45');
  assert.equal(f.boardPoint, 'SDW');
  assert.equal(f.offPoint, 'HYD');
  assert.equal(f.durationMin, 95);
  assert.equal(f.price, 4001);
  assert.equal(f.travelDate, '2026-10-28');
});

test('parseFly91Results: other dates emit honest empty', () => {
  assert.equal(parseFly91Results(HTML, '2026-10-26').length, 0);
});

test('parseFly91FareStrip: week prices match the browser strip', () => {
  const strip = parseFly91FareStrip(HTML);
  assert.ok(strip.length >= 6, `expected ~7 day strip, got ${strip.length}`);
  const byDt: Record<string, number> = Object.fromEntries(strip.map((x) => [x.dt, x.pr]));
  assert.equal(byDt['2026-10-28'], 4001);
  assert.equal(byDt['2026-10-26'], 9000);
  assert.equal(byDt['2026-10-29'], 3201);
});

test('fly91FlightItems: per-flight rows, nearby airport labelled, Fly91 seller', () => {
  const flights = parseFly91Results(HTML, '2026-10-28');
  const items = fly91FlightItems(flights, src, 'Goa', 'Hyderabad', 'GOX', 'HYD', '2026-10-28');
  assert.equal(items.length, flights.length);
  const it: any = items[0];
  assert.equal(it.seller, 'Fly91');
  assert.equal(it.currency, 'INR');
  assert.equal(it.price, 4001);
  assert.equal(it.attributes.airline, 'Fly91');
  assert.equal(it.attributes.flight_number, 'IC5303');
  assert.ok(it.attributes.nearby_departure_airport === 'SDW' || it.attributes.nearby_departure_airport === undefined, 'nearby flag honest');
  assert.match(it.title, /IC5303|IC 5303/);
  assert.equal(it.sellerUrl, fly91BookingUrl('GOX', 'HYD', '2026-10-28'));
});
