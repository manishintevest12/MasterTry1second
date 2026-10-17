import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteQuery, resolveCabQuery, routeFilter } from '../server/verticals/verticalEngine';
import type { NormalizedOffer, ParsedQuery } from '../server/types';

/** Owner bug 17 Oct (production-verified): the pincode/hotspot cab UI sends
 *  "Connaught Place (110001) to Terminal 3 Airport (110037) cab" — the route regex
 *  rejected digits/parens, the parse failed, and resolveCabQuery rewrote the search
 *  to the city DEFAULT route (Indore -> Bhopal), so users saw fares for a route they
 *  never typed. Search must be driven by what the user typed — never rewritten. */
test('parseRouteQuery: pincode/hotspot decorated routes parse (the UI format)', () => {
  const rt = parseRouteQuery('Connaught Place (110001) to Terminal 3 Airport (110037) cab');
  assert.ok(rt, 'pincode route parses');
  assert.equal(rt!.from.city, 'connaught place');
  assert.equal(rt!.to.city, 'terminal 3'); // 'airport' is PLACE_NOISE, stripped by normPlace
  const intra = parseRouteQuery('Sapna Sangeeta Mall (452001) to Khajrana Ganesh Mandir Indore cab');
  assert.ok(intra, 'Indore intra-city pincode route parses');
  assert.equal(intra!.to.city.includes('khajrana'), true);
});

test('parseRouteQuery: comma/slash locality text still parses (regression)', () => {
  const rt = parseRouteQuery('Chappan Dukan / MG Road, Indore to DLF Cyber City, Gurugram cab');
  assert.ok(rt);
  assert.equal(rt!.from.city.includes('indore'), true); // full locality text preserved
  assert.equal(rt!.to.city.includes('gurugram'), true);
  const plain = parseRouteQuery('indore to bhopal cab');
  assert.equal(plain!.from.city, 'indore');
  assert.equal(plain!.to.city, 'bhopal');
});

test('resolveCabQuery: a typed route is NEVER rewritten to a default route', () => {
  const q = 'Sapna Sangeeta Mall (452001) to Khajrana Ganesh Mandir Indore cab';
  assert.equal(resolveCabQuery(q), q, 'typed pincode route passes through unchanged');
  const pin = 'Rajwada (452001) to Indore Airport (452022) cab';
  assert.equal(resolveCabQuery(pin), pin);
  // default-route fallback only for queries with NO route at all (existing feature)
  assert.equal(resolveCabQuery('cab in indore'), 'Indore to Bhopal');
});

test('routeFilter: keeps app-only (Rapido) rows for a pincode route — both ends match', () => {
  const query = { rawQuery: 'Connaught Place (110001) to Terminal 3 Airport (110037) cab' } as unknown as ParsedQuery;
  const rapido = {
    vertical: 'cab', title: 'CP to T3 Rapido Bike Taxi', seller: 'Rapido',
    travel: { route: 'Connaught Place (110001) → Terminal 3 Airport (110037)' },
    attributes: { pickup: 'Connaught Place (110001)', drop: 'Terminal 3 Airport (110037)' },
  } as unknown as NormalizedOffer;
  const ola = {
    vertical: 'cab', title: 'CP to T3 Ola Auto', seller: 'Ola',
    travel: { route: 'connaught place (110001) to terminal 3 airport (110037)' },
  } as unknown as NormalizedOffer;
  const stranger = {
    vertical: 'cab', title: 'Indore to Bhopal cab', seller: 'X',
    travel: { route: 'indore to bhopal' },
  } as unknown as NormalizedOffer;
  const kept = routeFilter([rapido, ola, stranger], query);
  assert.ok(kept.some((o) => o.seller === 'Rapido'), 'Rapido app-only row survives');
  assert.ok(kept.some((o) => o.seller === 'Ola'), 'Ola priced row survives');
  assert.ok(!kept.some((o) => o.seller === 'X'), 'a default-route offer for a different route is filtered out');
});

test('routeFilter: locality-decorated UI routes survive — offer route keeps punctuation, typed side is normalized (owner bug 17 Oct: 11 offers, 0 shown)', () => {
  const query = { rawQuery: 'Chappan Dukan / MG Road, Indore to Martand Chowk, Indore' } as unknown as ParsedQuery;
  const ola = {
    vertical: 'cab', title: 'Chappan to Martand Ola Auto', seller: 'Ola',
    travel: { route: 'chappan dukan / mg road, indore to martand chowk, indore' },
  } as unknown as NormalizedOffer;
  const rapido = {
    vertical: 'cab', title: 'Chappan to Martand Rapido Bike', seller: 'Rapido',
    travel: { route: 'Chappan Dukan / MG Road, Indore → Martand Chowk, Indore' },
  } as unknown as NormalizedOffer;
  const stranger = {
    vertical: 'cab', title: 'Indore to Indore Jn. UberX', seller: 'Uber',
    travel: { route: 'indore to indore jn.' },
  } as unknown as NormalizedOffer;
  const wrongRoute = {
    vertical: 'cab', title: 'Indore to Bhopal cab', seller: 'X',
    travel: { route: 'indore to bhopal' },
  } as unknown as NormalizedOffer;
  const kept = routeFilter([ola, rapido, stranger, wrongRoute], query);
  assert.ok(kept.some((o) => o.seller === 'Ola'), 'Ola row with raw-punctuation route survives');
  assert.ok(kept.some((o) => o.seller === 'Rapido'), 'Rapido arrow-separated route survives');
  assert.ok(!kept.some((o) => o.seller === 'Uber'), 'an offer for a different intra-city route is filtered out');
  assert.ok(!kept.some((o) => o.seller === 'X'), 'a different-route offer is filtered out');
});
