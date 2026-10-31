import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError, reloadOnce } from '../src/lib/chunkRecovery';

/** Minimal browser stand-ins: the helpers only touch window.sessionStorage and window.location. */
const store = new Map<string, string>();
let reloads = 0;
(globalThis as any).window = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  location: { reload: () => void reloads++ },
  addEventListener: () => undefined,
};

beforeEach(() => {
  store.clear();
  reloads = 0;
});

test('recognises the exact error production threw when /flights went blank', () => {
  assert.equal(
    isChunkLoadError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://www.try1second.com/assets/ComparisonFeed-C_kdH_a-.js',
      ),
    ),
    true,
  );
  assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 42 failed')), true);
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined (reading map)')), false);
});

test('reloads once and then refuses to loop inside the guard window', () => {
  assert.equal(reloadOnce(), true);
  assert.equal(reloads, 1);
  // A second failure seconds later must NOT reload again: that is the difference between a
  // recovery and a refresh loop.
  assert.equal(reloadOnce(), false);
  assert.equal(reloads, 1);
});

test('also catches the browser-normalised forms that carry no useful wording', () => {
  // Live chromium reported only "TypeError: Failed to fetch" for the killed chunk fetch, and Safari
  // reports "Load failed"; without these the recovery card showed the generic copy instead of the
  // honest "this page did not load" one.
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch')), true);
  assert.equal(isChunkLoadError(new Error('Load failed')), true);
  assert.equal(isChunkLoadError(new TypeError('NetworkError when attempting to fetch resource.')), true);
});
