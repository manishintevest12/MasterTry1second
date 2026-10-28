/**
 * Ixigo bus source (owner 28 Oct: "inko add kro aur price le kr bhi aao inke").
 * The route page is SSR: its React flight payload carries the real per-service fares.
 * These tests pin the parser to the shapes captured live from
 * https://www.ixigo.com/buses/indore-bhopal-sts and pin the honesty rules:
 * the queried route/date wins, never a "similar routes" block and never zero fares.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ixigoCitySlug,
  ixigoFlightText,
  ixigoRoutePath,
  parseIxigoBusPage,
} from '../server/workers/parsers/ixigoBuses';

const source: any = { id: 'w_bus_ixigo', method: 'direct_http', vertical: 'bus' };

/** Build the `self.__next_f.push([1,"..."])` chunk the way Next.js emits it. */
function pushChunk(payload: string): string {
  return `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
}

function routeBlock(over: Record<string, any> = {}) {
  return {
    status: 'SUCCESS',
    operators: {},
    services: [
      {
        travelerAgentName: 'Jatashankar Travels',
        busTypeName: 'AC Sleeper (2 + 1)',
        serviceNumber: 'Service Number - 20261029739319',
        rating: 4.5,
        noOfRatings: 128,
        fares: { fare: 700, fareList: [700, 800] },
        timings: { startTime: '07:00 PM', arriveTime: '11:00 PM', travelTime: '04:00:00' },
      },
      {
        travelerAgentName: 'Nandan Travels',
        busTypeName: 'Non AC Seater (2 + 2)',
        serviceNumber: 'Service Number - 20261029555111',
        rating: 4.1,
        noOfRatings: 40,
        fares: { fare: 250, fareList: [250] },
        timings: { startTime: '09:30 PM', arriveTime: '02:15 AM', travelTime: '04:45:00' },
      },
      { travelerAgentName: 'No Fare Rows', fares: {}, timings: {} },
    ],
    sourceId: 100,
    destinationId: 1434,
    journeyDate: '2026-10-29',
    minFare: 250,
    maxFare: 6999,
    ...over,
  };
}

function page(blocks: any[]): string {
  const text = blocks.map((b) => JSON.stringify(b)).join('');
  const parts = text.match(/.{1,800}/g) || [];
  return `<!doctype html><html><body>${pushChunk('13:["$","main",null,{}]')}${parts.map(pushChunk).join('')}</body></html>`;
}

test('ixigo route path folds legacy city spellings into the -sts page', () => {
  assert.equal(ixigoRoutePath('Indore', 'Bhopal'), '/buses/indore-bhopal-sts');
  assert.equal(ixigoCitySlug('Bengaluru'), 'bangalore');
  assert.equal(ixigoRoutePath('New Delhi', 'Jaipur'), '/buses/delhi-jaipur-sts');
  assert.equal(ixigoCitySlug('Mumbai (BOM)'), 'mumbai');
});

test('flight payload chunks are JSON-decoded and rejoined', () => {
  const text = ixigoFlightText(page([routeBlock()]));
  assert.match(text, /"services"/);
  assert.match(text, /Jatashankar Travels/);
});

test('one row per real service with published fare, operator and timings', () => {
  const out = parseIxigoBusPage(
    page([routeBlock()]), source, 'https://www.ixigo.com/buses/indore-bhopal-sts', 'Indore', 'Bhopal', '2026-10-29',
  );
  assert.equal(out.journeyDate, '2026-10-29');
  assert.equal(out.serviceCount, 3);
  // The third service carries no fare: it must be dropped, never priced at zero.
  assert.equal(out.items.length, 2);
  const [first, second] = out.items;
  assert.equal(first.price, 700);
  assert.equal(first.seller, 'ixigo');
  assert.equal(first.attributes?.operator, 'Jatashankar Travels');
  assert.equal(first.attributes?.bus_type, 'AC Sleeper (2 + 1)');
  assert.equal(first.attributes?.journey_date, '2026-10-29');
  assert.equal(first.travel?.date, '2026-10-29');
  // Bus cards read the same normalized keys the redBus/AbhiBus rows emit.
  assert.equal(first.attributes?.departure_time, '19:00');
  assert.equal(first.attributes?.arrival_time, '23:00');
  assert.equal(first.attributes?.departure, '19:00 \u2192 23:00');
  assert.equal(first.attributes?.duration, '4h 0m');
  assert.equal(first.attributes?.duration_minutes, '240');
  assert.equal(second.price, 250);
  // 09:30 PM -> 02:15 AM crosses midnight and must be flagged (+1), not shown as a 5h backwards trip.
  assert.equal(second.attributes?.departure, '21:30 \u2192 02:15 (+1)');
  assert.equal(second.sellerUrl, 'https://www.ixigo.com/buses/indore-bhopal-sts');
});

test('another date\'s fares are refused, not relabelled', () => {
  const out = parseIxigoBusPage(
    page([routeBlock()]), source, 'https://www.ixigo.com/buses/indore-bhopal-sts', 'Indore', 'Bhopal', '2026-11-09',
  );
  assert.equal(out.items.length, 0);
  assert.match(String(out.reason), /2026-10-29/);
  assert.match(String(out.reason), /2026-11-09/);
});

test('a matching-date block wins over a similar-routes block', () => {
  const similar = routeBlock({ journeyDate: '2026-10-29', sourceId: 1, destinationId: 2 });
  const wanted = routeBlock({ journeyDate: '2026-11-09', sourceId: 100, destinationId: 1434 });
  const out = parseIxigoBusPage(
    page([similar, wanted]), source, 'https://www.ixigo.com/buses/indore-bhopal-sts', 'Indore', 'Bhopal', '2026-11-09',
  );
  assert.equal(out.items.length, 2);
  assert.equal(out.items[0].attributes?.journey_date, '2026-11-09');
});

test('empty service list and non-ixigo pages report an honest reason', () => {
  const empty = parseIxigoBusPage(page([routeBlock({ services: [] })]), source, 'https://www.ixigo.com/buses/x-y-sts', 'X', 'Y', '2026-10-29');
  assert.equal(empty.items.length, 0);
  assert.match(String(empty.reason), /no services/i);

  const foreign = parseIxigoBusPage('<html><body>maintenance</body></html>', source, 'https://www.ixigo.com/buses/x-y-sts', 'X', 'Y', '2026-10-29');
  assert.equal(foreign.items.length, 0);
  assert.match(String(foreign.reason), /no route payload/i);
});
