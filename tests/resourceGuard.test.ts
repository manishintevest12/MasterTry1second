/**
 * Resource-governor tests (owner 29 Oct):
 *
 * Hostinger put the whole account into its protective reCAPTCHA/CPU mode because of
 * "excessive CPU, memory or process usage", and that mode 403s/resets every mobile
 * request for every vertical. The account only recovers when the usage drops, so the
 * app must be able to stop its own optional work on command and after a restart loop.
 *
 * These tests pin the three switches that make that possible:
 *   - T1S_BACKGROUND=off / T1S_QUIET=1 -> no background work at all
 *   - a restart storm -> quiet boot for a while
 *   - guardBackground() reports honestly whether it ran the work or skipped it
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the guard at a throwaway data dir BEFORE importing it (it reads settings.dataDir).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't1s-governor-'));
process.env.T1S_DATA_DIR = tmp;
process.env.DATA_DIR = tmp;

const {
  backgroundAllowed, guardBackground, noteBoot, quietBoot, resourceSnapshot,
  startDeleteHold, deleteHoldActive, clearDeleteHold,
} = await import('../server/common/resourceGuard.js');
const { dataDir } = await import('../server/common/settings.js');

const bootFile = path.join(dataDir, 'boots.json');
const holdFile = path.join(dataDir, 'background-hold.json');

const clearAll = () => {
  delete process.env.T1S_BACKGROUND;
  delete process.env.T1S_QUIET;
  try { fs.unlinkSync(bootFile); } catch { /* none */ }
  try { fs.unlinkSync(holdFile); } catch { /* none */ }
};

test('background work is allowed by default', () => {
  clearAll();
  assert.equal(backgroundAllowed(), true);
});

test('T1S_BACKGROUND=off stops all optional work (site keeps serving)', () => {
  clearAll();
  process.env.T1S_BACKGROUND = 'off';
  assert.equal(backgroundAllowed(), false);
  clearAll();
});

test('T1S_QUIET=1 is the same switch, for the owner typing it in hPanel', () => {
  clearAll();
  process.env.T1S_QUIET = '1';
  assert.equal(backgroundAllowed(), false);
  clearAll();
});

test('a restart storm puts the app into quiet boot, then recovers on its own', () => {
  clearAll();
  const t0 = Date.now();
  assert.equal(noteBoot(t0).quiet, false);
  assert.equal(noteBoot(t0 + 1_000).quiet, false);
  assert.equal(noteBoot(t0 + 2_000).quiet, false);
  const storm = noteBoot(t0 + 3_000);          // 4th boot inside 30 min
  assert.equal(storm.quiet, true);
  assert.equal(quietBoot(t0 + 3_000), true);
  assert.equal(backgroundAllowed(), false);
  // the hold expires by itself, no owner action needed
  assert.equal(quietBoot(t0 + 31 * 60_000), false);
  clearAll();
});

test('old boots outside the window do not count as a storm', () => {
  clearAll();
  const t0 = Date.now();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(bootFile, JSON.stringify({ boots: [t0 - 40 * 60_000, t0 - 35 * 60_000, t0 - 31 * 60_000] }));
  assert.equal(noteBoot(t0).quiet, false, 'three stale boots fall out of the window');
  clearAll();
});

test('guardBackground reports whether it actually ran the work', async () => {
  clearAll();
  let ran = 0;
  const allowed = await guardBackground('test-job', () => { ran += 1; return 'done'; });
  assert.deepEqual(allowed, { ran: true, value: 'done' });
  process.env.T1S_BACKGROUND = 'off';
  const skipped = await guardBackground('test-job', () => { ran += 1; });
  assert.equal(skipped.ran, false);
  assert.equal(ran, 1, 'skipped work never executes');
  clearAll();
});

test('a manual hold pauses background work without touching traffic', () => {
  clearAll();
  startDeleteHold(60_000, 'owner pressed stop');
  assert.equal(deleteHoldActive(), true);
  assert.equal(backgroundAllowed(), false);
  clearDeleteHold();
  assert.equal(deleteHoldActive(), false);
  assert.equal(backgroundAllowed(), true);
});

test('the snapshot is honest about what this process is doing', () => {
  clearAll();
  const snap = resourceSnapshot();
  assert.ok(['ok', 'high', 'critical'].includes(snap.pressure));
  assert.equal(typeof snap.cpuPct, 'number');
  assert.equal(typeof snap.rssMb, 'number');
  assert.equal(snap.backgroundAllowed, backgroundAllowed());
  assert.match(snap.reason, /cpu/);
});
