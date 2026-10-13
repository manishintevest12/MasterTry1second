import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  agodaCitySlugs, extractAgodaCityId, extractAgodaPageConfig, agodaGateHeaders,
  buildAgodaCitySearchVars, extractAgodaProperties, parseAgodaHotels, parseAgodaOffers,
} from '../server/workers/parsers/agodaHotels';

const source: any = { id: 'w_hotels_agoda', method: 'direct_http', vertical: 'hotels' };
const fixture = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'agoda-city-search-live.json'), 'utf8'));

test('agoda: legacy city spellings get slug candidates', () => {
  const slugs = agodaCitySlugs('Bengaluru');
  assert.equal(slugs[0], 'bengaluru-in'); // tried first, 404s, then legacy:
  assert.ok(slugs.includes('bangalore-in'));
  assert.ok(agodaCitySlugs('New Delhi').includes('delhi-in'));
  assert.ok(agodaCitySlugs('Puducherry').includes('pondicherry-in'));
});

test('agoda: cityId extracted from SEO city page link', () => {
  const html = '<a href="https://www.agoda.com/search?city=11304&checkIn=2026-10-20">Goa</a>';
  assert.equal(extractAgodaCityId(html), 11304);
  assert.equal(extractAgodaCityId('<html></html>'), null);
});

test('agoda: pageConfig correlation ids recovered from SRP shell', () => {
  const html = `<script>agoda.pageConfig = {correlationId: "1-abc-123", analyticsSessionId: "sess-42", pageTypeId: 103}</script>`;
  const cfg = extractAgodaPageConfig(html);
  assert.equal(cfg?.correlationId, '1-abc-123');
  assert.equal(cfg?.analyticsSessionId, 'sess-42');
  assert.equal(extractAgodaPageConfig('<html>no config</html>'), null);
});

test('agoda: gate headers carry base64 epoch and AG-* ids', () => {
  const h = agodaGateHeaders({ correlationId: 'cor-1', analyticsSessionId: 'ana-1' }, 1700000000000);
  assert.equal(h['x-gate-meta'], Buffer.from('1700000000000||/graphql/search').toString('base64'));
  assert.equal(h['AG-CORRELATION-ID'], 'cor-1');
  assert.equal(h['AG-LANGUAGE-LOCALE'], 'en-us');
});

test('agoda: variables document has the required enums and objects', () => {
  const v = buildAgodaCitySearchVars(11304, '2026-10-20', '2026-10-23');
  assert.equal(v.CitySearchRequest.cityId, 11304);
  assert.equal(v.CitySearchRequest.searchRequest.searchCriteria.travellerType, 'AllGuests');
  assert.equal(v.CitySearchRequest.searchRequest.searchCriteria.requiredBasis, 'PRPN');
  assert.equal(v.CitySearchRequest.searchRequest.searchContext.memberId, 0);
  assert.ok(v.PricingSummaryRequest.context.clientInfo.searchId);
  assert.equal(v.PricingSummaryRequest.suggestedPrice, 'Exclusive');
  assert.ok(v.PricingSummaryRequest.pricing.features.isMSE === true);
  const occ = v.ContentSummaryRequest.context.occupancy.checkIn;
  assert.equal(occ, '2026-10-20T00:00:00.000Z'); // DateTime scalar, not bare date
});

test('agoda: parses priced properties, skips unpriced and id-less junk', () => {
  const hotels = parseAgodaHotels(extractAgodaProperties(fixture));
  assert.equal(hotels.length, 3); // no-propertyId entry skipped; unpriced kept (filtered at offer time)
  const h = hotels[0];
  assert.equal(h.name, 'Palette Resort Argya Santi Jimbaran');
  assert.equal(h.propertyId, '61779679');
  assert.equal(h.pricePerNight, 1454.53);
  assert.ok(h.imageUrl && h.imageUrl.startsWith('https://pix8.agoda.net/'));
  assert.ok(h.score && h.score > 0);
  assert.equal(hotels[2].name, 'IZE Seminyak by LifestyleRetreats');
  assert.ok(hotels[2].pricePerNight! > 1000); // IZE 5631.40 per night
  assert.equal(hotels[1].pricePerNight, null); // unpriced entry kept, filtered at offer time
});

test('agoda: offers are price-only with own-site deeplink and honest note', () => {
  const hotels = parseAgodaHotels(extractAgodaProperties(fixture));
  const offers = parseAgodaOffers(hotels, source, 'Bali', { cityId: 17193, checkin: '2026-10-20', los: 3 });
  assert.equal(offers.length, 2);
  const o = offers[0];
  assert.equal(o.seller, 'Agoda');
  assert.equal(o.price, 1455); // Math.round of 1454.53
  assert.equal(o.currency, 'INR');
  assert.ok(String(o.sellerUrl).startsWith('https://www.agoda.com/search?city=17193'));
  assert.ok(o.attributes!.price_basis.includes('per night on Agoda'));
  assert.ok(o.attributes!.data_note.includes('Agoda'));
  assert.ok(o.attributes!.image_url.startsWith('https://'));
});
