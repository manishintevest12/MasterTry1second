/**
 * Read-only self-heal guards (owner 24 Oct prod log: 410x "INSERT command denied
 * to user ... for table offers / canonical_entities").
 *
 * Hostinger's database-size monitor flips an over-cap DB into read-only mode by
 * revoking INSERT/UPDATE while keeping DELETE + OPTIMIZE, so the customer can
 * shrink back under the cap. These guards pin the contract of that self-heal:
 *   - the denial detector must fire the emergency shrink only for real
 *     privilege errors (not for ordinary SQL bugs), and never in a hot loop;
 *   - the caps must keep the DB at ~half the 3072 MB host limit, because on
 *     24 Oct the host engaged read-only at ~2335 MB while the loop believed
 *     only its SOFT threshold was breached;
 *   - the warm window (searches 7d) must survive the emergency retention scale.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pruneSrc = readFileSync('server/catalogue/prune.ts', 'utf8');

describe('read-only self-heal (notifyWriteDenied)', () => {
  it('hook is wired into both observed failure paths', () => {
    const catalogue = readFileSync('server/catalogue/catalogueService.ts', 'utf8');
    const matching = readFileSync('server/pipeline/entityMatching.ts', 'utf8');
    assert.match(catalogue, /notifyWriteDenied\(String\(e\)\)/, 'catalogueService persist catch calls the hook');
    assert.match(matching, /notifyWriteDenied\(String\(e\)\)/, 'entityMatching resolution catch calls the hook');
  });

  it('only real privilege denials trigger the emergency shrink', () => {
    assert.match(pruneSrc, /command denied\|read\.only/i, 'detector matches INSERT command denied + read-only');
    assert.match(pruneSrc, /lastEmergencyShrinkAt < 10 \* 60_000/, 'throttled to one pass per 10 minutes');
    assert.match(pruneSrc, /emergencyShrinkRunning/, 're-entrancy guard present');
  });

  it('emergency shrink compacts EVERY compactable table, not one per hour', () => {
    assert.match(pruneSrc, /for \(const table of COMPACTABLE\)[\s\S]*?OPTIMIZE TABLE/, 'back-to-back compaction loop exists');
  });

  it('caps recalibrated to engage well below the host flip point', () => {
    const soft = Number(pruneSrc.match(/const SOFT_CAP_MB = (\d+)/)?.[1]);
    const hard = Number(pruneSrc.match(/const HARD_CAP_MB = (\d+)/)?.[1]);
    assert.ok(soft <= 1200, `SOFT cap must be <= 1200 MB (got ${soft})`);
    assert.ok(hard >= soft && hard <= 1800, `HARD cap must be within [SOFT, 1800] MB (got ${hard})`);
  });

  it('searches warm window (7d) survives the emergency retention scale', () => {
    const m = pruneSrc.match(/\['searches',[^\]]*daysAgo\(Math\.max\(RETENTION\.searchesDays \* scale, 8\)\)/);
    assert.ok(m, 'searches retention is floored at 8 days regardless of scale');
  });
});
