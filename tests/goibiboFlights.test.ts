/**
 * Goibibo flights regression (17 Oct): SEO route landing pages are SSR with the
 * full listing state in __NEXT_DATA__ -> props.pageProps.data.state.listing.
 * parseGoibiboSsr walks journeys.allJourneys[0][] (fare = total INR,
 * simpleAirlineHeading.nm = airline, journeyKeys = ORIG$DEST$YYYY-MM-DD HH:MM$FLNO
 * legs joined by |) and journeyMap.data for dep/arr times and stops. Offers carry
 * the page's own real date (flightSearchParams.itinerary).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoibiboSsr, goibiboRouteUrl } from '../server/workers/parsers/goibiboFlights.ts';

const src: any = { id: 't_flights_goibibo', name: 'Goibibo', method: 'http', verticals: ['flights'], enabled: true, priority: 5, config: {}, rateLimit: { maxRequestsPerMinute: 10, maxConcurrency: 2 }, freshnessPolicy: {} };
const PAGE = 'https://www.goibibo.com/flights/delhi-to-mumbai-flights/';

function giHtml(listing: any) {
  const fixture = { props: { pageProps: { data: { state: { listing } } } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(fixture)}</script></body></html>`;
}

function baseListing() {
  return {
    flightSearchParams: { itinerary: 'DEL-BOM-20/10/2026' },
    journeyMap: {
      data: {
        'DEL$BOM$2026-10-20 06:50$QP-1833': { depTime: '06:50', arrTime: '09:05', duration: { h: '02', m: '15' }, stops: 0, depCityCd: 'DEL', arrCityCd: 'BOM', depCity: "<font color='#717171'>New Delhi</font>", arrCity: "<font color='#717171'>Mumbai</font>" },
        'DEL$LKO$2026-10-20 06:00$IX-1165': { depTime: '06:00', arrTime: '07:25', duration: { h: '01', m: '25' }, stops: 0, depCityCd: 'DEL', arrCityCd: 'LKO' },
        'LKO$BOM$2026-10-20 08:40$IX-1027': { depTime: '08:40', arrTime: '10:55', duration: { h: '02', m: '15' }, stops: 0, depCityCd: 'LKO', arrCityCd: 'BOM' },
      },
    },
    journeys: {
      allJourneys: [[
        { fare: 6406, finalFare: '₹ 6,406', flightNumber: 'IX 1165, IX 1027', simpleAirlineHeading: { cd: 'IX-1165 | IX-1027', nm: 'Air India Express' }, airlineCodes: ['IX'], journeyKeys: ['DEL$LKO$2026-10-20 06:00$IX-1165|LKO$BOM$2026-10-20 08:40$IX-1027'] },
        { fare: 6675, finalFare: '₹ 6,675', flightNumber: 'QP 1833', simpleAirlineHeading: { cd: 'QP-1833', nm: 'Akasa Air' }, airlineCodes: ['QP'], journeyKeys: ['DEL$BOM$2026-10-20 06:50$QP-1833'] },
        { fare: 0, flightNumber: '6E 353', simpleAirlineHeading: { cd: '6E-353', nm: 'IndiGo' }, airlineCodes: ['6E'], journeyKeys: ['DEL$BOM$2026-10-20 03:30$6E-353'] }, // priceless: skipped
      ]],
    },
  };
}

test('goibibo: SSR journeys parse with real fares, times, stops, seller Goibibo, page date', () => {
  const items = parseGoibiboSsr(giHtml(baseListing()), src, PAGE, 'Delhi', 'Mumbai');
  assert.equal(items.length, 2); // priceless journey skipped
  const [one, two] = items;
  assert.equal(one.brand, 'Air India Express');
  assert.equal(one.price, 6406);
  assert.equal(one.seller, 'Goibibo');
  assert.equal(one.sellerUrl, PAGE);
  assert.equal(one.attributes!.stops, '1');
  assert.equal(one.attributes!.departure, '06:00');
  assert.equal(one.attributes!.arrival, '10:55');
  assert.equal(one.attributes!.destination, 'BOM');
  assert.equal(one.travel!.date, '2026-10-20');
  assert.ok(String(one.title).includes('Air India Express'));
  assert.ok(String(one.attributes!.data_note).includes('2026-10-20'));
  assert.equal(two.brand, 'Akasa Air');
  assert.equal(two.price, 6675);
  assert.equal(two.attributes!.stops, '0');
  assert.equal(two.attributes!.departure, '06:50');
});

test('goibibo: missing journey segment or empty state returns empty, never throws', () => {
  assert.deepEqual(parseGoibiboSsr('<html>no next data</html>', src, PAGE, 'Delhi', 'Mumbai'), []);
  assert.deepEqual(parseGoibiboSsr(giHtml({}), src, PAGE, 'Delhi', 'Mumbai'), []);
  // journey whose key is absent from journeyMap: skipped honestly
  const l: any = baseListing();
  l.journeys.allJourneys[0] = [{ fare: 5000, flightNumber: 'AI 100', simpleAirlineHeading: { nm: 'Air India' }, journeyKeys: ['DEL$BOM$2099-01-01 06:00$AI-100'] }];
  assert.deepEqual(parseGoibiboSsr(giHtml(l), src, PAGE, 'Delhi', 'Mumbai'), []);
});

test('goibibo: route URL slugs use legacy spellings (bengaluru->bangalore, new delhi->delhi)', () => {
  assert.equal(goibiboRouteUrl('New Delhi', 'Mumbai'), 'https://www.goibibo.com/flights/delhi-to-mumbai-flights/');
  assert.equal(goibiboRouteUrl('Bengaluru', 'Goa'), 'https://www.goibibo.com/flights/bangalore-to-goa-flights/');
  assert.equal(goibiboRouteUrl('Thiruvananthapuram', 'Delhi'), 'https://www.goibibo.com/flights/trivandrum-to-delhi-flights/');
});
