/**
 * Star Air regression (24 Oct 2026): Crane Aero IBE at book-sdg.crane.aero.
 * Fixtures recorded LIVE via cold-session curl_cffi GETs 24 Oct 2026:
 *  - starair_avail_bom_klh.html: S5-164 BOM 10:35 -> KLH 11:40, 1h 05m,
 *    non-stop, economy best offer INR 4,563 (STAR REGULAR), business 7,000.
 *    7-day strip: 26 Oct 7,800 / 28 Oct 4,563 / 30 Oct 4,814.
 *  - starair_avail_bom_amd.html: connecting journey S5-705 + S5-629
 *    (1 stop, 5h 35m), from INR 7,199.
 * Guards: exact URL shape (DD.MM.YYYY dates), journey data-attr decode,
 * per-cabin fare binding, multi-flight flight-no join, exact-date honesty,
 * item parity fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starAvailUrl, starDateParam, starValidDestinations, parseStarAirAvailability, starFareStrip, starAirFlightItems } from '../server/workers/parsers/starAirCrane.ts';

const src: any = { id: 't_flights_starair', name: 'Star Air', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };
const KLH = readFileSync(new URL('./fixtures/starair_avail_bom_klh.html', import.meta.url), 'utf8');
const AMD = readFileSync(new URL('./fixtures/starair_avail_bom_amd.html', import.meta.url), 'utf8');

test('starDateParam + starAvailUrl replay the exact CDP-captured shape', () => {
  assert.equal(starDateParam('2026-10-28'), '28.10.2026');
  const u = starAvailUrl('BOM', 'KLH', '2026-10-28');
  assert.ok(u.startsWith('https://book-sdg.crane.aero/ibe/availability?'));
  assert.ok(u.includes('tripType=ONE_WAY'));
  assert.ok(u.includes('depPort=BOM'));
  assert.ok(u.includes('arrPort=KLH'));
  assert.ok(u.includes('departureDate=28.10.2026'));
  assert.ok(u.includes('cabinClasses=ECONOMY'));
  assert.ok(u.includes('passengerQuantities%5B0%5D%5BpassengerType%5D=ADLT'));
  assert.ok(u.includes('passengerQuantities%5B0%5D%5Bquantity%5D=1'));
});

test('parseStarAirAvailability: S5-164 decodes with times, duration, both cabin fares', () => {
  const j = parseStarAirAvailability(KLH, '2026-10-28');
  assert.equal(j.length, 1);
  const f = j[0];
  assert.equal(f.flightNo, 'S5-164');
  assert.equal(f.depTime, '10:35');
  assert.equal(f.arrTime, '11:40');
  assert.equal(f.fromCode, 'BOM');
  assert.equal(f.toCode, 'KLH');
  assert.equal(f.stops, 0);
  assert.equal(f.durationMin, 65);
  assert.equal(f.fareEconomy, 4563);
  assert.equal(f.fareBusiness, 7000);
  assert.equal(f.depDateIso, '2026-10-28');
});

test('parseStarAirAvailability: connecting journey joins flight numbers with stops', () => {
  const j = parseStarAirAvailability(AMD, '2026-10-28');
  assert.equal(j.length, 1);
  const f = j[0];
  assert.equal(f.flightNo, 'S5-705,S5-629');
  assert.equal(f.depTime, '13:55');
  assert.equal(f.arrTime, '19:30');
  assert.equal(f.stops, 1);
  assert.equal(f.durationMin, 335);
  assert.equal(f.fareEconomy, 7199);
});

test('parseStarAirAvailability: other dates emit honest empty', () => {
  assert.equal(parseStarAirAvailability(KLH, '2026-11-15').length, 0);
});

test('starFareStrip: 7-day date-level lowest fares', () => {
  const strip = starFareStrip(KLH);
  // OWNER 2 Nov: the strip carries DAY NUMBERS only, so the parser resolves each day to its
  // nearest upcoming occurrence instead of stamping the current month (a strip opened on 28 Oct
  // used to label 2 Nov as 2026-10-02). Assertions are therefore day-of-month based and date
  // independent - the old fixed '2026-10-26' keys started failing once October passed.
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const byDay = Object.fromEntries(strip.map((s) => [Number(s.dateIso.slice(8, 10)), s.price]));
  assert.deepEqual(Object.keys(byDay).map(Number).sort((a, b) => a - b), [26, 28, 30]);
  assert.equal(byDay[26], 7800);
  assert.equal(byDay[28], 4563);
  assert.equal(byDay[30], 4814);
  assert.equal(strip.length, 3); // 25/27/29/31 have no service - absent honestly
  for (const s of strip) {
    assert.ok(new Date(`${s.dateIso}T00:00:00Z`).getTime() >= today.getTime(), `${s.dateIso} must not be in the past`);
  }
});

test('starAirFlightItems: parity fields + Star Air direct seller', () => {
  const j = parseStarAirAvailability(KLH, '2026-10-28');
  const items = starAirFlightItems(j, src, 'Mumbai', 'Kolhapur', '2026-10-28');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.seller, 'Star Air');
  assert.equal(it.currency, 'INR');
  assert.equal(it.price, 4563);
  assert.equal(it.attributes.flight_number, 'S5-164');
  assert.equal(it.attributes.departure, '10:35');
  assert.equal(it.attributes.arrival, '11:40');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.attributes.stops, '0');
  assert.equal(it.attributes.duration, '1h 5m');
  assert.equal(it.travel.date, '2026-10-28');
  assert.ok(it.title.includes('S5-164'));
  assert.ok(it.attributes.fare_class.includes('STAR REGULAR'));
});

test('starValidDestinations: parses the LoadDestination JSON (route honesty)', async () => {
  const canned = '[{"Value":"","Text":"To"},{"Value":"AMD","Text":"Ahmedabad (AMD)"},{"Value":"KLH","Text":"Kolhapur (KLH)"}]';
  const dests = await starValidDestinations('BOM', async () => canned);
  assert.deepEqual(dests, ['AMD', 'KLH']);
  const broken = await starValidDestinations('BOM', async () => { throw new Error('gate'); });
  assert.deepEqual(broken, []);
});
