import test from 'node:test';
import assert from 'node:assert/strict';
import { distinctSellerCount, dropUnpricedRows, reconcileVerifiedSources, enforceRequestedTravelDate, enforceRequestedCity, normalizeTravelDate, offerTravelDate, priceOfRow } from '../server/search/travelDateGate';

/** OWNER 2 Nov: "19-11-2026 search kiya, result 2-11-2026 ka bata raha hai - aise issue hr
 *  vertical fix kro". These pin the rule that a date-answering vertical may only show rows for
 *  the date the user asked for. */

test('dates are read in every format our partners actually emit', () => {
  assert.equal(normalizeTravelDate('2026-11-19'), '2026-11-19');
  assert.equal(normalizeTravelDate('2026-11-19T00:00:00Z'), '2026-11-19');
  assert.equal(normalizeTravelDate('19/11/2026'), '2026-11-19');   // EaseMyTrip/MMT calendars
  assert.equal(normalizeTravelDate('19-11-2026'), '2026-11-19');   // AbhiBus/bus rows
  assert.equal(normalizeTravelDate('2026/12/20'), '2026-12-20');
  assert.equal(normalizeTravelDate('19 Nov 2026'), '2026-11-19');
  assert.equal(normalizeTravelDate('Nov 19, 2026'), '2026-11-19');
  assert.equal(normalizeTravelDate('19 Nov 2026 06:00'), '2026-11-19');
  // Month-first is still understood when day-first is impossible.
  assert.equal(normalizeTravelDate('11/19/2026'), '2026-11-19');
  // Unreadable stays empty rather than inventing a date.
  assert.equal(normalizeTravelDate(''), '');
  assert.equal(normalizeTravelDate('tomorrow'), '');
  assert.equal(normalizeTravelDate('2026-13-45'), '');
});

test('the row date is found in travel.date and in the catalogue attribute names', () => {
  assert.equal(offerTravelDate({ travel: { date: '2026-11-19' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { travel_date: '19/11/2026' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { departure_date: '2026-11-19' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { checkin: '20/11/2026' } }), '2026-11-20');
  assert.equal(offerTravelDate({ attributes: {} }), '');
});

test('a 19 Nov flight search can no longer show a 2 Nov (or any other day) card', () => {
  const rows = [
    { title: 'right day (ISO)', travel: { date: '2026-11-19' } },
    { title: 'right day (EMT calendar format)', attributes: { travel_date: '19/11/2026' } },
    { title: 'fare-calendar fallback to today', travel: { date: '2026-11-02' } },
    { title: 'fallback, no travel.date but dated attribute', attributes: { travel_date: '02/11/2026' } },
    { title: 'presence card (no priced date)', prices: { effectivePrice: 0 } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-19' });
  assert.deepEqual(gate.kept.map((r) => r.title), [
    'right day (ISO)',
    'right day (EMT calendar format)',
    'presence card (no priced date)',
  ]);
  assert.equal(gate.dropped, 2);
  // Both fallback rows answer 2 Nov, one via travel.date and one via a dated attribute.
  assert.deepEqual(gate.droppedOn, { '2026-11-02': 2 });
});

test('measured production case: a 20 Dec search carrying a 19 Nov batch is emptied', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ title: `flight ${i}`, travel: { date: '2026-11-19' } }));
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-12-20' });
  assert.equal(gate.kept.length, 0);
  assert.equal(gate.dropped, 40);
});

test('a return trip accepts the outbound or the return date, never a third date', () => {
  const rows = [
    { travel: { date: '2026-11-19' } },
    { travel: { date: '2026-11-23' } },
    { travel: { date: '2026-11-21' } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-19', return: '2026-11-23' });
  assert.equal(gate.kept.length, 2);
  assert.equal(gate.dropped, 1);
});

test('hotels are checked against the check-in date', () => {
  const rows = [
    { attributes: { checkin: '2026-11-19' } },
    { attributes: { checkin: '2026-11-02' } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'hotels', { depart: '2026-11-19' });
  assert.equal(gate.kept.length, 1);
  assert.equal(gate.dropped, 1);
});

test('vertical with no date semantics is never filtered, and no date asked means no filtering', () => {
  const rows = [{ travel: { date: '2026-11-02' } }];
  assert.equal(enforceRequestedTravelDate(rows, 'grocery', { depart: '2026-11-19' }).dropped, 0);
  assert.equal(enforceRequestedTravelDate(rows, 'flights', {}).dropped, 0);
  assert.equal(enforceRequestedTravelDate(rows, 'flights', { depart: 'not-a-date' }).dropped, 0);
});

test('a date range inside the hotel query never leaks into the city slug', async () => {
  // Owner 2 Nov: before chasing more edges, stop poisoning the slug. Measured: the query
  // 'hotels in Shimla 19 November 2026 to 21 November 2026' produced the city "Shimla to", so
  // every city-page hotel source 404'd and the seller silently disappeared from the answer.
  const { cityFromQuery } = await import('../server/workers/verticals/hotels');
  const cases: Array<[string, string]> = [
    ['hotels in Shimla 19 November 2026 to 21 November 2026', 'Shimla'],
    ['hotels in Shimla from 19 Nov 2026 till 21 Nov 2026', 'Shimla'],
    ['book a hotel in Goa 2026-11-19 to 2026-11-21', 'Goa'],
    ['cheap stays in Manali under 3000', 'Manali'],
  ];
  for (const [raw, want] of cases) {
    const got = cityFromQuery({ query: { rawQuery: raw, location: {} } } as any);
    assert.equal(got, want, `${raw} -> ${got}`);
  }
  // a two-word city still survives
  assert.equal(cityFromQuery({ query: { rawQuery: 'hotels in Mount Abu 19 Nov 2026 to 21 Nov 2026' } } as any), 'Mount Abu');
});

// OWNER 3 Nov: "any row that does not match the exact requested date must be instantly dropped",
// and the measured leak was 31 flights rows dated 2026-11-03 answering a 2026-11-27 search.
test('strict mode drops undated rows but keeps seller presence cards', () => {
  const rows: any[] = [
    { id: 'off_1', travel: { date: '2026-11-27' }, title: '6E-6627 IDR to DEL' },
    { id: 'off_2', travel: { date: '2026-11-03' }, title: '6E-9999 IDR to DEL' },
    { id: 'off_3', title: 'Air India IDR to DEL' },                       // undated, not presence
    { id: 'presence_makemytrip', title: 'MakeMyTrip', attributes: {} },     // presence card
    { id: 'off_4', title: 'Yatra', attributes: { price_basis: 'live_fares_unavailable' } },
  ];
  const strict = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-27' }, { strictUndated: true });
  assert.deepEqual(strict.kept.map((r: any) => r.id), ['off_1', 'presence_makemytrip', 'off_4']);
  assert.equal(strict.dropped, 2);
  assert.equal(strict.droppedOn['2026-11-03'], 1);
  assert.equal(strict.droppedOn['undated'], 1);
  // default mode still keeps undated rows (catalogue/schedule rows rely on it)
  const lenient = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-27' });
  assert.equal(lenient.kept.length, 4);
});

// OWNER 3 Nov: "fix hotels results now it should give results in first poll". A hotel catalogue
// row is a property, not a dated fare, so an undated one is kept as a PRICE-LESS presence card
// instead of being dropped (which emptied the first paint: measured 0 rows on the first two polls
// of a 20 Nov Shimla search, 87 rows only at ~40s). Wrong-dated rows must still disappear.
test('hotels keep undated rows as price-less presence cards, never wrong-dated ones', () => {
  const rows: any[] = [
    { id: 'h1', travel: { date: '2026-11-20' }, prices: { effectivePrice: '4200' }, title: 'Hotel A' },
    { id: 'h2', travel: { date: '2026-12-02' }, prices: { effectivePrice: '3100' }, title: 'Hotel B' },
    { id: 'h3', prices: { effectivePrice: '2600' }, title: 'Hotel C' },   // undated property row
  ];
  const strictOnly = enforceRequestedTravelDate(rows, 'hotels', { depart: '2026-11-20', return: '2026-11-22' }, { strictUndated: true });
  assert.deepEqual(strictOnly.kept.map((r: any) => r.id), ['h1']);

  const withPresence = enforceRequestedTravelDate(rows, 'hotels', { depart: '2026-11-20', return: '2026-11-22' }, { strictUndated: true, undatedAsPresence: true });
  assert.deepEqual(withPresence.kept.map((r: any) => r.id), ['h1', 'h3']);
  const kept3 = withPresence.kept.find((r: any) => r.id === 'h3')!;
  assert.equal(Number(kept3.prices.effectivePrice), 0, 'an undated card must claim no price');
  assert.equal(kept3.attributes.price_basis, 'live_fares_unavailable');
  assert.equal(withPresence.droppedOn['undated_as_presence'], 1);
  // the wrong-dated hotel is still gone
  assert.equal(withPresence.kept.some((r: any) => r.id === 'h2'), false);
  assert.equal(withPresence.droppedOn['2026-12-02'], 1);
  // flights do NOT get the treatment: an undated flight row is still dropped
  const flights = enforceRequestedTravelDate(
    [{ id: 'f1', prices: { effectivePrice: '5000' }, title: '6E-1' }] as any,
    'flights', { depart: '2026-11-20' }, { strictUndated: true },
  );
  assert.equal(flights.kept.length, 0);
});

// OWNER 3 Nov: "hotels in Shimla 5 Nov to 7 Nov 2 adults" answered 40 rows whose attributes.city
// is Manali. A catalogue hotel row carries no travel date, so the date gate had nothing to say.
test('hotels cannot answer with another city; other verticals are untouched', () => {
  const rows: any[] = [
    { id: 'cat_1', seller: 'Agoda', attributes: { city: 'Manali' }, prices: { effectivePrice: '18891' } },
    { id: 'cat_2', seller: 'Agoda', attributes: { city: 'Shimla' }, prices: { effectivePrice: '3200' } },
    { id: 'cat_3', seller: 'Agoda', attributes: {} , prices: { effectivePrice: '2500' } },  // no city named
  ];
  const g = enforceRequestedCity(rows, 'hotels', 'Shimla');
  assert.deepEqual(g.kept.map((r: any) => r.id), ['cat_2', 'cat_3']);
  assert.equal(g.droppedCities.manali, 1);
  // "Shimla" vs a longer label still matches
  assert.equal(enforceRequestedCity([{ id: 'x', attributes: { city: 'Shimla, Himachal Pradesh' } }] as any, 'hotels', 'Shimla').kept.length, 1);
  // flights keep their rows
  assert.equal(enforceRequestedCity([{ id: 'f', attributes: { city: 'Manali' } }] as any, 'flights', 'Shimla').kept.length, 1);
  // no requested city = no filtering
  assert.equal(enforceRequestedCity(rows, 'hotels', '').kept.length, 3);
});

// OWNER 3 Nov: "jab tak live price data ni aa raha tb tk kuch v show mt kro" - a card with no
// live price must not be shown at all (this reverses the price-less presence behaviour).
test('price-less rows never reach the answer; lead verticals are exempt', () => {
  const rows: any[] = [
    { id: 'priced', prices: { effectivePrice: '7370' } },
    { id: 'presence_ixigo', prices: {}, attributes: { price_basis: 'live_fares_unavailable' } },
    { id: 'undated_hotel', prices: { effectivePrice: '0' }, attributes: { undated_listing: '1' } },
    { id: 'string_price', prices: { effectivePrice: 'Rs 2,499' } },
  ];
  for (const v of ['flights', 'hotels', 'bus', 'ecommerce']) {
    const g = dropUnpricedRows(rows, v);
    assert.deepEqual(g.kept.map((r: any) => r.id), ['priced', 'string_price'], `${v} keeps only priced rows`);
    assert.equal(g.dropped, 2);
  }
  // loan/insurance/card/account answers are lead requests, never filtered by price
  assert.equal(dropUnpricedRows(rows, 'loans').dropped, 0);
  assert.equal(priceOfRow({ prices: { effectivePrice: 'Rs 2,499' } }), 2499);
});

// OWNER 3 Nov (screenshot): header said "40 live offers · 8 sources verified" while the SELLERS
// facet listed only OYO and EaseMyTrip. Verified sources must mean the shops on screen.
test('verified sources are reconciled to the rows the user can see', () => {
  const rows: any[] = [
    { id: '1', seller: 'OYO', prices: { effectivePrice: '1899' } },
    { id: '2', seller: 'EaseMyTrip', prices: { effectivePrice: '2499' } },
    { id: '3', seller: 'oyo', prices: { effectivePrice: '2199' } },
  ];
  const declared = [
    'w_hotels_oyo', 'w_hotels_emt', 'w_hotels_agoda', 'w_hotels_yatra',
    'w_hotels_booking', 'w_hotels_expedia', 'w_hotels_ixigo', 'w_hotels_cleartrip',
  ];
  const verified = reconcileVerifiedSources(rows, declared);
  assert.deepEqual(verified, ['w_hotels_oyo', 'w_hotels_emt'], 'only the shops with a visible row survive');
  assert.equal(distinctSellerCount(rows), 2, 'OYO and EaseMyTrip are the two shops on screen');
  // No rows at all: nothing can be claimed as verified.
  assert.deepEqual(reconcileVerifiedSources([], declared), []);
  // Source ids that do not line up with seller names still never claim more than the shops shown.
  const odd = reconcileVerifiedSources([{ id: 'x', vendor: 'Saffron Stays', prices: { effectivePrice: '900' } }], declared);
  assert.equal(odd.length, 1);
  // Flights: a seller name and its source id match through the alias table.
  assert.deepEqual(
    reconcileVerifiedSources([{ id: 'f', seller: 'MakeMyTrip', prices: { effectivePrice: '5200' } }], ['w_flights_mmt', 'w_flights_ixigo', 'w_flights_yatra']),
    ['w_flights_mmt'],
  );
});
