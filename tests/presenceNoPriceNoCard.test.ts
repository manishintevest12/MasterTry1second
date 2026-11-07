import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// OWNER 3 Nov rule "no price, no card" + 7 Nov screenshot (flights showed IndiGo/Expedia/BudgetAir
// cards with no fare): unpriced seller-presence cards must be OFF unless deliberately switched on.
test('presence cards are gated behind T1S_PRESENCE_CARDS', () => {
  const src = readFileSync(new URL('../server/search/searchOrchestrator.ts', import.meta.url), 'utf8');
  const calls = src.match(/buildFlightSellerPresence\(/g) || [];
  assert.ok(calls.length >= 2, 'both presence call sites still exist');
  const gated = src.match(/T1S_PRESENCE_CARDS/g) || [];
  assert.ok(gated.length >= 2, 'both call sites check T1S_PRESENCE_CARDS');
  for (const line of src.split('\n')) {
    if (!line.includes('buildFlightSellerPresence(') || line.trim().startsWith('import')) continue;
    const idx = src.indexOf(line);
    const window = src.slice(Math.max(0, idx - 400), idx);
    assert.ok(window.includes('T1S_PRESENCE_CARDS'), `ungated presence call: ${line.trim()}`);
  }
});
