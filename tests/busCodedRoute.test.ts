import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromQuery } from '../server/workers/verticals/bus';

// OWNER 9 Nov: "flights ab fix ho gaya bus abhi v fix ni hua". The bus box submits the flights-style
// route "Indore (IDR) to Bhopal (BHO)"; production answered 0 rows for it in ~2s while the plain
// "Indore to Bhopal" query answered 15. The bracketed code was being kept inside the city name.
test('a route typed with airport codes becomes clean city names', () => {
  assert.deepEqual(routeFromQuery('Indore (IDR) to Bhopal (BHO)'), { from: 'Indore', to: 'Bhopal' });
  assert.deepEqual(routeFromQuery('Indore (IDR) → Bhopal (BHO)'), { from: 'Indore', to: 'Bhopal' });
  assert.deepEqual(routeFromQuery('indore to bhopal'), { from: 'Indore', to: 'Bhopal' });
});

test('multi-word cities keep their words, punctuation does not leak into the source query', () => {
  assert.deepEqual(routeFromQuery('New Delhi (DEL) to Jaipur (JAI)'), { from: 'New Delhi', to: 'Jaipur' });
  assert.deepEqual(routeFromQuery('Indore to Bhopal bus 2026-11-22'), { from: 'Indore', to: 'Bhopal' });
});
