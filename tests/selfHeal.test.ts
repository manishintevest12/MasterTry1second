import test from 'node:test';
import assert from 'node:assert/strict';
import { getHealSpec, extractScriptSrcsForTest } from '../server/acquisition/selfHeal';

test('selfHeal: BMS spec rule extracts /api/explore from a real-shaped bundle fragment', () => {
  const spec = getHealSpec('w_movies_bookmyshow')!;
  assert.ok(spec);
  const frag = 'Q={sit:"https://x"}[p],q=`${l}/api/explore`,z=`${l}/api/seo/v1/footer`';
  const rule = spec.rules.find((r) => r.key === 'explore_api_path')!;
  const m = new RegExp(rule.pattern.source).exec(frag);
  assert.equal(m?.[1], '/api/explore');
});

test('selfHeal: bundleFilter keeps only app/common/explore chunks, drops ads/vendor', () => {
  const spec = getHealSpec('w_movies_bookmyshow')!;
  const urls = [
    'https://generic-web-assets-in.bmscdn.com/public/build/chunks/js/app.b9956c4b.js',
    'https://generic-web-assets-in.bmscdn.com/public/build/chunks/js/vendor-primary.7ef97d4e.js',
    'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
  ];
  assert.deepEqual(urls.filter((u) => spec.bundleFilter.test(u)), [urls[0]]);
});

test('selfHeal: script src extraction + unknown source reports honestly', () => {
  const html = '<script src="/a.js"></script><script defer src=\'https://c/b.js\'></script>';
  assert.deepEqual(extractScriptSrcsForTest(html), ['/a.js', 'https://c/b.js']);
  assert.equal(getHealSpec('nope'), undefined);
});
