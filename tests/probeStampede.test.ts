import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * OWNER 10 Nov runtime log (be09fdee0_runtimefix.docx). The self-healing ladder was making things worse:
 *  13:42:37, 13:42:41, 13:42:51 -> "ProxyDiscovery probed 60, passed 0" three times in 14 seconds
 *  and "GateHeal expedia: no candidate passed the gated request (tried 60)" three times likewise,
 * because three searches opened gates at once and every caller started its own sweep. Concurrent callers now
 * share ONE sweep, and one heal per host runs at a time.
 */
test('concurrent proxy discovery runs share one sweep instead of probing N times', async () => {
  process.env.T1S_PROXY_SOURCES = ''; // no list downloads: the sweep itself is what we count
  const { runProxyDiscovery } = await import('../server/common/proxyDiscovery');
  const [a, b, c] = await Promise.all([
    runProxyDiscovery({ limit: 1, target: { url: 'https://example.com', label: 'a' } as any }),
    runProxyDiscovery({ limit: 1, target: { url: 'https://example.com', label: 'b' } as any }),
    runProxyDiscovery({ limit: 1, target: { url: 'https://example.com', label: 'c' } as any }),
  ]);
  // Same run: identical report object identity means the 2nd and 3rd callers joined the 1st sweep.
  assert.equal(a.startedAt, b.startedAt);
  assert.equal(b.startedAt, c.startedAt);
  assert.equal(a.probed, b.probed);
});

test('a host never heals twice at the same time', async () => {
  const { healGatedSource } = await import('../server/common/gateHeal');
  let sweeps = 0;
  const discover = async () => {
    sweeps += 1;
    await new Promise((r) => setTimeout(r, 30));
    return { kept: [], probed: 10, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() } as any;
  };
  const stateFile = `/tmp/t1s-heal-${process.pid}-${Date.now()}.json`;
  const poolFile = `/tmp/t1s-pool-${process.pid}-${Date.now()}.json`;
  const opts = { discover, stateFile, poolFile, force: true } as any;
  const results = await Promise.all([
    healGatedSource('indigo', opts),
    healGatedSource('indigo', opts),
    healGatedSource('indigo', opts),
  ]);
  assert.equal(sweeps, 3, 'force=true keeps three explicit admin sweeps (nothing is silently dropped)');
  assert.equal(results.filter((r) => r.ran).length, 3);

  // Without force, one heal runs and the other callers await that same result.
  sweeps = 0;
  const first = healGatedSource('indigo', { discover, stateFile: `${stateFile}.b`, poolFile });
  const second = healGatedSource('indigo', { discover, stateFile: `${stateFile}.b`, poolFile });
  assert.equal(first, second, 'the second caller gets the in-flight heal, not a new sweep');
  await Promise.all([first, second]);
  assert.equal(sweeps, 1);
});
