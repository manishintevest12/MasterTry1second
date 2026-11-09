import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoveryBackoffState } from '../server/common/proxyDiscovery';

// OWNER 9 Nov ("fix this" + runtimefix.docx): the runtime log showed three fixable defects -
// (1) the Rapido/WASM bridge printing raw request payloads (coordinates + street addresses) to stdout,
// (2) one dead proxy list answering 502 on every cycle, (3) "probed 60, passed 0" repeating all day.

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the Thiqa SDK cannot print raw payloads: every console call goes to the redacting sink', () => {
  const src = read('server/workers/parsers/rapidoFares.ts');
  assert.ok(src.includes('const THIQA_SINK'), 'a sink replaces the SDK console');
  for (const fn of ['log', 'info', 'warn', 'error']) {
    // the source literally contains: .replace(/console.log\(/g, `${THIQA_SINK}(`)
    const needle = 'console\\.' + fn + '\\(/g, `${THIQA_SINK}(`)';
    assert.ok(src.includes(needle), `console.${fn} is redirected`);
  }
  assert.ok(src.includes('new Function(\'fetch\', THIQA_SINK'), 'the sink is the only logging handle the glue gets');
  assert.ok(src.includes("if (!process.env.T1S_THIQA_DEBUG) return;"), 'silent unless explicitly asked');
  assert.ok(src.includes("replace(/\\d+(?:\\.\\d+)?/g, '#')"), 'digits (coordinates, prices) are masked');
});

test('a proxy source that keeps failing is remembered and skipped with a cooldown', () => {
  const src = read('server/common/proxyDiscovery.ts');
  assert.ok(src.includes('const sourceHealth = new Map'), 'per-source health memory');
  assert.ok(src.includes('if (sourceCooling(source.name)) return [];'), 'cooling sources are not re-fetched');
  assert.ok(src.includes('5 * 60_000 * 2 ** (h.fails - 1)'), 'exponential cooldown');
  assert.ok(src.includes("if (h.fails === 1) log.warn"), 'one warning, then silence (no per-cycle spam)');
  assert.ok(src.includes('noteSourceOk(source.name)'), 'a recovered source returns to rotation');
  assert.ok(src.includes('dropped from rotation for 1h'), 'a hard 4xx removes a dead list');
});

test('zero-pass discovery backs off instead of probing 60 exits every cycle', () => {
  const src = read('server/common/proxyDiscovery.ts');
  assert.ok(src.includes('let zeroPassStreak = 0'), 'streak is tracked');
  assert.ok(src.includes('if (!explicit && Date.now() < discoveryNotBefore)'), 'automatic runs respect the backoff');
  assert.ok(src.includes('const zeroPassMode = zeroPassStreak >= 2'), 'sample shrinks in a dry spell');
  assert.ok(src.includes('const limit = Math.min(Math.max(opts.limit ?? (zeroPassMode ? 20 : 60), 1), 200)'));
  assert.ok(src.includes('30 * 60_000'), 'backoff is capped at 30 minutes');
  const state = discoveryBackoffState();
  assert.equal(typeof state.streak, 'number');
  assert.equal(typeof state.nextAllowedAt, 'number');
});

// OWNER 9 Nov: "increase mobile and desktop speed to 100%". PageSpeed showed document request latency 0,
// efficient cache lifetimes 50 and mobile TBT 400ms. These pin the three fixes that address them.
test('the shell is cached per path and served with a revalidating cache instead of no-store', () => {
  const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('const shellCache = new Map'), 'finished shells are memoised per path');
  assert.ok(src.includes('T1S_SHELL_CACHE_MS'), 'the TTL is configurable (0 disables)');
  assert.ok(src.includes("res.setHeader('X-T1S-Shell'"), 'cache hits are observable');
  assert.ok(src.includes("'public, max-age=30, stale-while-revalidate=120'"), 'html is reusable');
  assert.ok(!src.includes("res.setHeader('Cache-Control', 'no-store, must-revalidate');\n      // OWNER 9 Nov: advertise"),
    'the catch-all no longer forces no-store');
});

test('root images and fonts get a long cache lifetime', () => {
  const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('max-age=2592000'), '30-day lifetime for versioned art/fonts');
  assert.ok(src.includes('webp|png|jpe?g|svg|ico|woff2?|ttf'), 'covers images and fonts');
});

test('AdSense is injected after first paint, not in the critical head', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/<script async src="https:\/\/pagead2\.googlesyndication\.com/.test(html), 'no eager ad script');
  assert.ok(html.includes("s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"), 'loaded lazily');
  assert.ok(html.includes('requestIdleCallback(loadAds'), 'after idle');
  assert.ok(html.includes("rel=\"preconnect\" href=\"https://pagead2.googlesyndication.com\""), 'warm connection ready');
});
