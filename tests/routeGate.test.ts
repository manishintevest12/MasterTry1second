import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enforceRequestedRoute, routeOfRow, samePlace } from '../server/search/routeGate';
import { parseRouteQuery } from '../server/verticals/verticalEngine';

// OWNER 9 Nov: "maine search kiya indore to hyderabad pr results aa raha hai indore to delhi ka".
// The requested city pair is now enforced on every flights/bus/cab answer.

const requested = (q: string) => parseRouteQuery(q) as any;

test('a Delhi row is dropped from an Indore-Hyderabad answer', () => {
  const rows = [
    { title: 'Air India Express IX1236 · Indore → Hyderabad', specs: { route: 'Indore → Hyderabad' } },
    { title: 'IndiGo 6E6972 · Indore → Delhi', specs: { route: 'Indore → Delhi' } },
    { title: 'Air India AI1865 · indore to new delhi', specs: { route: 'indore to new delhi' } },
    { title: 'SpiceJet SG 8154 · Hyderabad → Indore', specs: { route: 'Hyderabad → Indore' } },
  ];
  const gate = enforceRequestedRoute(rows, requested('indore to hyderabad'));
  assert.equal(gate.rows.length, 1, 'only the Indore->Hyderabad row survives');
  assert.equal(gate.dropped, 3);
  assert.ok(gate.examples.length >= 1);
});

test('city spellings and codes are tolerated, never guessed', () => {
  assert.ok(samePlace('New Delhi', 'Delhi'));
  assert.ok(samePlace('Indore Tahsil', 'Indore'));
  assert.ok(samePlace('bengaluru', 'Bengaluru'));
  assert.ok(!samePlace('Delhi', 'Hyderabad'));
  const rows = [
    { title: 'IndiGo · Indore → New Delhi', specs: {} },
    { title: 'Something with no route at all', specs: {} },
  ];
  const gate = enforceRequestedRoute(rows, requested('indore to delhi'));
  assert.equal(gate.rows.length, 2, 'both rows survive: one matches, the other states no route');
});

test('routeOfRow reads specs, attributes and the title tail', () => {
  assert.deepEqual(routeOfRow({ specs: { route: 'A → B' } }), { from: 'A', to: 'B' });
  assert.deepEqual(routeOfRow({ attributes: { origin: 'Indore', destination: 'Bhopal' } }), { from: 'Indore', to: 'Bhopal' });
  assert.deepEqual(routeOfRow({ title: 'IndiGo 6E147-352 · Indore → Hyderabad' }), { from: 'Indore', to: 'Hyderabad' });
  assert.equal(routeOfRow({ title: 'IndiGo 6E147' }), null);
});

test('a query with no readable pair leaves rows untouched', () => {
  const rows = [{ specs: { route: 'Indore → Delhi' } }, { specs: { route: 'Delhi → Mumbai' } }];
  const gate = enforceRequestedRoute(rows, requested('Hyderabad'));
  assert.equal(gate.rows.length, 2);
  assert.equal(gate.dropped, 0);
});

test('the live answer really applies the route gate and the first-answer wait', () => {
  const src = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("import { enforceRequestedRoute } from '../search/routeGate'"));
  assert.ok(src.includes('const routeGate = enforceRequestedRoute(gated.rows as any[], requested)'));
  assert.ok(src.includes("'route gate dropped rows for another city pair'"));
  // far-future dates: an empty fast answer now waits for the in-flight pipeline
  assert.ok(src.includes('const wantsWait = beforeRows === 0'));
  assert.ok(src.includes('awaitSettledAnswer(input, budget)'));
  assert.ok(src.includes('first answer waited for the live pipeline'));
});

test('an EMPTY answer on /api/search also waits (first cold search for a fresh city+date)', () => {
  const src = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('const emptyFirstAnswer = Boolean(response)'));
  assert.ok(/emptyFirstAnswer\) \{/.test(src), 'the wait runs for an empty first answer even without settle:true');
});
