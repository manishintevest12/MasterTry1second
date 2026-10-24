/**
 * 24h home-section cache (owner 23 Oct): /api/quick-apps, home showcase,
 * hero banners, section banners and rewards top-picks serve from an
 * in-process 24h cache; admin edits purge instantly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedSection, purgeSectionCache } from '../server/api/cachedSections';

test('cachedSection builds once then serves the same value', async () => {
  purgeSectionCache();
  let builds = 0;
  const v = await cachedSection('t:one', async () => { builds += 1; return { rows: [1, 2, 3] }; });
  assert.equal(builds, 1);
  assert.deepEqual(v.rows, [1, 2, 3]);
  const again = await cachedSection('t:one', async () => { builds += 1; return { rows: [] }; });
  assert.equal(builds, 1); // cache hit, builder never ran
  assert.deepEqual(again.rows, [1, 2, 3]); // cached value, not the new empty one
});

test('cachedSection honors a short TTL (expiry works)', async () => {
  purgeSectionCache();
  const v1 = await cachedSection('t:ttl', async () => 'a', 20); // 20ms
  assert.equal(v1, 'a');
  await new Promise((r) => setTimeout(r, 30));
  const v2 = await cachedSection('t:ttl', async () => 'b', 20);
  assert.equal(v2, 'b'); // expired -> rebuilt
});

test('a failed build throws and is never cached', async () => {
  purgeSectionCache();
  await assert.rejects(() => cachedSection('t:throw', async () => { throw new Error('boom'); }));
  // a later successful build still works and caches
  const v = await cachedSection('t:throw', async () => 'ok');
  assert.equal(v, 'ok');
});

test('purgeSectionCache: prefix purge + full purge', async () => {
  purgeSectionCache();
  await cachedSection('rewards:a', async () => 1);
  await cachedSection('rewards:b', async () => 2);
  await cachedSection('home:c', async () => 3);
  purgeSectionCache('rewards:');
  let builds = 0;
  const a = await cachedSection('rewards:a', async () => { builds += 1; return 10; }); // rebuilt
  const c = await cachedSection('home:c', async () => { builds += 1; return 30; }); // still cached
  assert.equal(a, 10);
  assert.equal(c, 3);
  assert.equal(builds, 1);
  purgeSectionCache();
  builds = 0;
  const c2 = await cachedSection('home:c', async () => { builds += 1; return 30; });
  assert.equal(builds, 1); // full purge cleared it too
});
