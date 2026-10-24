import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Owner 24 Oct: food vertical used to show ONLY Swiggy on gated moments —
 * Zomato and Toing died as bare TIMEOUTs:
 *  - Zomato: 3 x 12s default fetches + 6 x 12s menu deep-dive vs the 18s
 *    default task kill -> the honest presence row (owner rule 23 Oct: Zomato
 *    is ALWAYS in results) never survived an Akamai tarpit.
 *  - Toing: 3 x 22s shell pages + 6 x 22s menu probes (worst ~198s) vs 18s.
 * Budget-aware now: every fetch short-bounded, task windows explicit, deep
 * dives check the deadline and ship partial results. These pins keep the
 * budget math from regressing.
 */
const foodSrc = readFileSync('server/workers/verticals/food.ts', 'utf8');

test('zomato task: bounded ladder + deadline-aware deep dive', () => {
  // Explicit task window (26s) instead of the 18s default kill.
  assert.ok(/sourceId: 'w_food_zomato',[\s\S]{0,900}?timeoutMs: 26_000/.test(foodSrc),
    'zomato task declares a 26s window');
  // Listing attempts capped at 4.5s — 3 attempts + gaps always fit the window.
  const attempts = foodSrc.match(/ctx\.fetch\(url, \{ timeoutMs: 4_500 \}\)/g) || [];
  assert.equal(attempts.length, 2, 'both listing fetches capped at 4.5s');
  // The gated ladder must also stop when the budget is spent.
  assert.ok(/left\(\) > 6_000/.test(foodSrc), 'retry ladder respects the deadline');
  // Menu deep-dive: bounded fetches + deadline bail so partial dishes land.
  assert.ok(/ctx\.fetch\(ru, \{ timeoutMs: 3_500 \}\)/.test(foodSrc), 'restaurant pages capped at 3.5s');
  assert.ok(/if \(left\(\) < 4_000\) break;/.test(foodSrc), 'deep dive bails when out of budget');
  // Presence fallback still the guaranteed floor on any non-200.
  assert.ok(/if \(r\.status !== 200\) return zomatoPresence/.test(foodSrc),
    'non-200 still falls back to the honest presence row');
});

test('toing task: bounded shell/menu fetches ship partial dishes', () => {
  assert.ok(/sourceId: 'w_food_toing',[\s\S]{0,900}?timeoutMs: 32_000/.test(foodSrc),
    'toing task declares a 32s window');
  const shell = foodSrc.match(/cffiFetch\(shellUrl,[\s\S]{0,160}?timeoutMs: 7_000/g) || [];
  assert.equal(shell.length, 1, 'shell fetch capped at 7s');
  const menu = foodSrc.match(/disc\.swiggy\.com\/api\/v2\/dynamicmenu[\s\S]{0,160}?timeoutMs: 5_000/g) || [];
  assert.equal(menu.length, 1, 'dynamicmenu probe capped at 5s');
  assert.ok(/if \(left\(\) < 5_500\) break;/.test(foodSrc), 'menu deep dive bails when out of budget');
});

test('worst-case fetch math fits the task windows', () => {
  // Zomato: 3 x 4.5s + 2 x 0.9s gaps = 15.3s < 26s; deep dive worst 6 x 3.5s = 21s
  // but the soft deadline (24s) + bail at <4s left caps the whole run < 26s.
  const zomatoLadder = 3 * 4_500 + 2 * 900;
  assert.ok(zomatoLadder < 26_000, `zomato ladder ${zomatoLadder}ms fits 26s window`);
  // Toing: 3 x 7s shell = 21s; menu probes bail at <5.5s of a 30s soft deadline.
  const toingShell = 3 * 7_000;
  assert.ok(toingShell < 32_000, `toing shell ${toingShell}ms fits 32s window`);
});
