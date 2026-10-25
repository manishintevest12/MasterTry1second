import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseBudgetAirCalendar,
  budgetAirCalendarUrl,
  budgetAirDayFareItems,
} from '../server/workers/parsers/budgetAirFlights';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'budgetairCalendar.json'), 'utf8'));

test('budgetAirCalendarUrl builds the SOA2 calendar GET', () => {
  const u = budgetAirCalendarUrl('DEL', 'BOM');
  assert.match(u, /^https:\/\/rest\.budgetair\.com\/restapi\/soa2\/36017\/lowPrice_lowPriceCalendarSearch\?/);
  assert.match(u, /departureCode=DEL/);
  assert.match(u, /arrivalCode=BOM/);
  assert.match(u, /currency=INR/);
});

test('parseBudgetAirCalendar reads string and float totals, skips null/zero fares', () => {
  const fares = parseBudgetAirCalendar(fixture);
  assert.ok(fares.length >= 6, `expected >=6 priced dates, got ${fares.length}`);
  const exact = fares.find((f) => f.date === '2026-10-28');
  assert.ok(exact, 'fixture must contain 2026-10-28');
  assert.equal(exact.price, 7075);
  // shape tolerance: string totals, numeric totals, junk entries
  const mixed = parseBudgetAirCalendar({
    ResponseStatus: { Ack: 'Success' },
    response: [
      { date: '2026-10-28', totalPrice: '7075' },
      { date: '2026-10-29', totalPrice: 6833.5 },
      { date: '2026-10-30', totalPrice: null },
      { date: '2026-10-31', totalPrice: '0' },
      { date: 'not-a-date', totalPrice: '10' },
      null,
      'junk',
    ],
  });
  assert.deepEqual(mixed.map((m) => m.date), ['2026-10-28', '2026-10-29']);
  assert.equal(mixed[1].price, 6833.5);
});

test('budgetAirDayFareItems prefers the exact requested date', () => {
  const fares = parseBudgetAirCalendar(fixture);
  const source = { id: 'w_flights_budgetair', name: 'BudgetAir', vertical: 'flights' } as any;
  const items = budgetAirDayFareItems(fares, source, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28');
  assert.equal(items.length, 1);
  const it = items[0] as any;
  assert.equal(it.seller, 'BudgetAir');
  assert.equal(it.prices?.effectivePrice ?? it.price, 7075);
  assert.match(it.sellerUrl, /budgetair\.com\/en_us\/flights\/DEL\/BOM\/2026-10-28$/);
  assert.equal(it.attributes.travel_date, '2026-10-28');
  assert.match(String(it.title), /on 2026-10-28/);
});

test('budgetAirDayFareItems falls back to cheapest upcoming when exact date has no fare', () => {
  const fares = parseBudgetAirCalendar(fixture);
  const source = { id: 'w_flights_budgetair', name: 'BudgetAir', vertical: 'flights' } as any;
  const items = budgetAirDayFareItems(fares, source, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2027-06-15');
  assert.equal(items.length, 1);
  const it = items[0] as any;
  assert.match(String(it.title), /cheapest upcoming/);
  // cheapest of the fixture dates
  const prices = fares.map((f) => f.price).sort((a, b) => a - b);
  assert.equal(it.prices?.effectivePrice ?? it.price, Math.round(prices[0]));
});

test('budgetAirDayFareItems emits nothing for an empty calendar', () => {
  const source = { id: 'w_flights_budgetair', name: 'BudgetAir', vertical: 'flights' } as any;
  assert.deepEqual(budgetAirDayFareItems([], source, 'a', 'b', 'AAA', 'BBB', '2026-10-28'), []);
});
