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
  assert.equal(routeFloorMatches('indore idr to delhi del', { title: 'Air India AI-806', subtitle: '', travel: { route: 'New Delhi to Indore' }, attributes: {} }), true);
});
