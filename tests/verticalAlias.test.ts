import test from 'node:test';
import assert from 'node:assert/strict';

test('vertical alias: UI tab ids normalize to engine ids (account/movies)', async () => {
  const { normalizeVerticalId } = await import('../server/search/verticalAlias');
  assert.equal(normalizeVerticalId('account'), 'banking', 'Flutter/web account searches must map to the banking engine id');
  assert.equal(normalizeVerticalId('movie'), 'movies');
  assert.equal(normalizeVerticalId('flights'), 'flights');
  assert.equal(normalizeVerticalId(undefined), '');
  assert.equal(normalizeVerticalId('Account'), 'banking', 'case-insensitive');
});

test('vertical alias: getVerticalEngine NEVER returns undefined (unknown vertical must not crash the process)', async () => {
  const { getVerticalEngine } = await import('../server/verticals/verticalEngine');
  // Regression (21 Oct): ENGINES['account'] was undefined and the live pipeline
  // crashed the whole Node process with `engine.execute` on a TypeError. Any
  // vertical id must now degrade to an honest pass-through engine.
  const e = (getVerticalEngine as any)('account');
  assert.ok(e, 'engine must exist for account (was undefined -> server crash)');
  assert.ok(typeof e.execute === 'function');
  const out = await e.execute([{ id: 'o1', vertical: 'account', title: 'Zero balance savings', seller: 'HDFC', price: 0 }], {} as any);
  assert.equal(out.length, 1, 'unknown-vertical engine passes offers through for honest ranking');
  const unknown = (getVerticalEngine as any)('bogus_vertical');
  assert.ok(unknown && typeof unknown.execute === 'function', 'even garbage ids get a pass-through engine, never a crash');
});
