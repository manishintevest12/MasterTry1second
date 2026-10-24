/**
 * Route-aware catalogue floor (owner 23 Oct, destination-matrix audit):
 * 'Indore to Shirdi' cold-start painted wrong-route buses (Indore->Bhopal/Goa)
 * from the city catalogue until the live pass landed. A borrowed bus/flights
 * row must now name the queried destination + origin, or the floor skips it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFloorMatches } from '../server/search/searchOrchestrator';

const goaRow = { title: 'Indore to Goa zingbus', subtitle: 'zingbus', travel: { route: 'Indore to Goa' }, attributes: {} };
const operatorOnlyRow = { title: 'Humsafar Travels · AC Sleeper', subtitle: 'AbhiBus', travel: {}, attributes: {} };
const flightRow = { title: 'IndiGo 6E-503', subtitle: 'IndiGo', travel: { route: 'Indore (IDR) to Goa (GOI)' }, attributes: { route: 'Indore to Goa' } };

test('route query: matching destination + origin passes', () => {
  assert.equal(routeFloorMatches('Indore to Goa', goaRow), true);
  assert.equal(routeFloorMatches('Indore (IDR) to Goa (GOI)', flightRow), true);
});

test('route query: wrong destination is rejected, never painted cold', () => {
  assert.equal(routeFloorMatches('Indore to Shirdi', goaRow), false);
  assert.equal(routeFloorMatches('Indore to Shirdi', flightRow), false);
});

test('route query: row without route text is rejected (ambiguous beats wrong)', () => {
  assert.equal(routeFloorMatches('Indore to Shirdi', operatorOnlyRow), false);
});

test('non-route query keeps the old behaviour (no filtering)', () => {
  assert.equal(routeFloorMatches('biryani', operatorOnlyRow), true);
  assert.equal(routeFloorMatches(undefined, goaRow), true);
});

test('lowercase/iata variants still match', () => {
  assert.equal(routeFloorMatches('indore idr to delhi del', { title: 'Air India AI-806', subtitle: '', travel: { route: 'Indore to New Delhi' }, attributes: {} }), true);
});

// Owner 24 Oct ("indore se mumbai bola to indore-delhi dikha raha hai"): the
// floor now matches the row's DECLARED route endpoints, direction included.
// A reverse-direction borrowed row is a wrong-route row for a one-way trip.
test('reverse-direction route row is rejected (direction matters)', () => {
  assert.equal(routeFloorMatches('indore idr to delhi del', { title: 'Air India AI-806', subtitle: '', travel: { route: 'New Delhi to Indore' }, attributes: {} }), false);
});

// Owner 24 Oct: a borrowed itinerary whose title MENTIONS the destination as
// a via stop ("... via Mumbai · Indore → Delhi") must not leak into an
// Indore->Mumbai search — endpoint sides are matched, not the whole text.
test('via-stop mention does not satisfy the queried destination', () => {
  const viaRow = { title: 'Air India AI2616 + AI2556 via Mumbai · Indore → Delhi (1 stop)', subtitle: '', attributes: {} };
  assert.equal(routeFloorMatches('Indore to Mumbai', viaRow), false);
  assert.equal(routeFloorMatches('Indore to Delhi', viaRow), true);
});


// Owner 23 Oct cab follow-up: intra-city cab floor borrowed a DIFFERENT route's rows
// from the same city ("Bhawarkuan to Rajwada" painted "Palasia to Rajwada"). The cab
// vertical now uses the same strict origin+destination gate as bus/flights.
test('cab intra-city: borrowed floor row with the WRONG origin is rejected', () => {
  const olaRow = { title: 'Palasia to Rajwada Indore cab (Ola Bike, one-way)', subtitle: 'Ola', travel: { route: 'Palasia to Rajwada Indore' }, attributes: {} };
  assert.equal(routeFloorMatches('Bhawarkuan to Rajwada, Indore', olaRow), false);
});

test('cab intra-city: floor row matching the queried origin+destination passes', () => {
  const olaRow = { title: 'Bhawarkuan to Rajwada Indore cab (Ola Bike, one-way)', subtitle: 'Ola', travel: { route: 'Bhawarkuan to Rajwada Indore' }, attributes: {} };
  assert.equal(routeFloorMatches('Bhawarkuan to Rajwada, Indore', olaRow), true);
});

test('cab intercity: Indore to Bhopal floor rows keep passing (no regression)', () => {
  const bharatRow = { title: 'Indore to Bhopal cab (Maruti Swift Dzire, one-way)', subtitle: 'Bharat Taxi', travel: { route: 'Indore to Bhopal' }, attributes: {} };
  assert.equal(routeFloorMatches('Indore to Bhopal', bharatRow), true);
});
