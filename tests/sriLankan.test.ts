/**
 * SriLankan Airlines regression (24 Oct 2026): Amadeus pl-next IBE chain.
 * Fixture recorded LIVE via Browserbase CDP 24 Oct 2026: availability page
 * (FlexPricerAvailabilityDispatcherPui) for MAA->CMB 28 Oct 2026 with the
 * embedded business.Availability flex-pricer JSON: UL0122 MAA 09:50 ->
 * CMB 11:10 (32B, non-stop); cheapest recommendation 9,495 INR
 * (base 3,705 + tax 5,790, family EINSAS4, 1 seat left).
 * Guards: Imperva stub detection, override body shape, ENC hex extraction,
 * availability JSON brace-match extraction, exact-date flight decode,
 * cheapest-fare selection, per-flight item parity fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slIsImpervaStub, slIdxxui, slOverrideBody, slEncFromOverridePage, parseSriLankanAvailability, sriLankanFlightItems } from '../server/workers/parsers/sriLankanPlnext.ts';

const src: any = { id: 't_flights_srilankan', name: 'SriLankan Airlines', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 3, maxConcurrency: 1 }, freshnessPolicy: {} };
const HTML = readFileSync(new URL('./fixtures/srilankan_avail_maa_cmb.html', import.meta.url), 'utf8');

test('slIsImpervaStub detects both gate shapes honestly', () => {
  assert.equal(slIsImpervaStub('<script src="/_Incapsula_Resource?SWJIYLWA=5074a744"></script>'), true);
  assert.equal(slIsImpervaStub('<title>Pardon Our Interruption</title>'), true);
  assert.equal(slIsImpervaStub('<html><body>real page</body></html>'), false);
});

test('slIdxxui extracts the widget anti-bot token', () => {
  assert.equal(slIdxxui('<input type="hidden" id="idxxui" value="vzdcqgadrgrfadyuclzc53n3" />'), 'vzdcqgadrgrfadyuclzc53n3');
  assert.equal(slIdxxui('<html></html>'), '');
});

test('slOverrideBody replays the exact CDP-captured widget chain', () => {
  const b = new URLSearchParams(slOverrideBody('MAA', 'CMB', 'Chennai (MAA)', 'Colombo (CMB)', '2026-10-28', 'tok123'));
  assert.equal(b.get('seldcity1'), 'MAA');
  assert.equal(b.get('selacity1'), 'CMB');
  assert.equal(b.get('selddate1'), '2026-10-28');
  assert.equal(b.get('fromdate'), '202610280000');
  assert.equal(b.get('tid'), 'OW');
  assert.equal(b.get('selcabinclass'), 'E');
  assert.equal(b.get('seladults'), '1');
  assert.equal(b.get('idxxui'), 'tok123');
  assert.equal(b.get('sitelang'), 'GB');
});

test('slEncFromOverridePage finds the server-generated ENC hex', () => {
  assert.equal(slEncFromOverridePage('<input id="ENC" value="F9EF53D790CCF50F04C9F6E9A3F0531697E1CC909A77266452E702412871B40CC0C5A3A5837CBF3A54DCE5912E799C7F58DF159E53C80DC3BAAC835E"/>'), 'F9EF53D790CCF50F04C9F6E9A3F0531697E1CC909A77266452E702412871B40CC0C5A3A5837CBF3A54DCE5912E799C7F58DF159E53C80DC3BAAC835E');
  assert.equal(slEncFromOverridePage('<html>no hex here</html>'), null);
});

test('parseSriLankanAvailability: UL122 decodes with times, aircraft, cheapest fare', () => {
  const parsed = parseSriLankanAvailability(HTML, '2026-10-28');
  assert.ok(parsed, 'fixture must parse');
  const f = parsed!.flights.find((x) => x.flightNo === 'UL122');
  assert.ok(f, 'UL122 present');
  assert.equal(f!.depTime, '09:50');
  assert.equal(f!.arrTime, '11:10');
  assert.equal(f!.fromCode, 'MAA');
  assert.equal(f!.toCode, 'CMB');
  assert.equal(f!.stops, 0);
  assert.equal(f!.aircraft, '32B');
  assert.equal(f!.depDateIso, '2026-10-28');
  assert.equal(parsed!.cheapestFare, 9495);
  assert.equal(parsed!.base, 3705);
  assert.equal(parsed!.tax, 5790);
  assert.equal(parsed!.fareFamily, 'EINSAS4');
});

test('parseSriLankanAvailability: other dates emit honest empty', () => {
  assert.equal(parseSriLankanAvailability(HTML, '2026-11-15'), null);
});

test('sriLankanFlightItems: parity fields + honest SriLankan-direct seller', () => {
  const parsed = parseSriLankanAvailability(HTML, '2026-10-28')!;
  const items = sriLankanFlightItems(parsed.flights, parsed.cheapestFare, parsed.fareFamily, parsed.tax, parsed.base, parsed.seats, src, 'Chennai', 'Colombo', '2026-10-28');
  assert.equal(items.length, parsed.flights.length);
  const it: any = items[0];
  assert.equal(it.seller, 'SriLankan Airlines');
  assert.equal(it.currency, 'INR');
  assert.equal(it.price, 9495);
  assert.equal(it.attributes.flight_number, 'UL122');
  assert.equal(it.attributes.departure, '09:50');
  assert.equal(it.attributes.arrival, '11:10');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.ok(it.title.includes('UL122'));
  for (const r of items as any[]) {
    assert.ok(r.attributes.flight_number, 'flight_number always present');
    assert.equal(r.travel.date, '2026-10-28');
  }
});
