/**
 * "Loader ke baad 'No matching options found' nahi aana chahiye" (owner 28 Oct, two screenshots:
 * Movies tab badge 28, feed empty; sidebar still said live prices were loading).
 *
 * Three ways the trust-breaking empty page used to appear are pinned here:
 *   1. rows arriving tagged `movies` while the feed filters on `movie`,
 *   2. a user filter hiding every real row,
 *   3. the poll chain releasing to empty while rows still come back later.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedProgressGate } from '../src/lib/feedProgressGate';
import { canonicalizeRows, canonicalVertical, sameVertical } from '../src/lib/verticalAlias';

test('movie / movies are the same vertical, so ingestion canonicalises the tag', () => {
  assert.equal(canonicalVertical('movies'), 'movie');
  assert.equal(canonicalVertical('movie'), 'movie');
  assert.equal(sameVertical('movies', 'movie'), true);
  assert.equal(sameVertical('bus', 'movie'), false);
  const rows = canonicalizeRows([{ vertical: 'movies', title: 'Jolly LLB 3' }, { vertical: 'bus', title: 'NueGo' }]);
  assert.equal(rows[0].vertical, 'movie');
  assert.equal(rows[1].vertical, 'bus');
});

test('the exact screenshot: 28 rows tagged movies are visible to the movie feed', () => {
  const engineRows = Array.from({ length: 28 }, (_, i) => ({ vertical: 'movies', title: `Film ${i}` }));
  const feedRows = canonicalizeRows(engineRows).filter((it) => sameVertical(it.vertical, 'movie'));
  assert.equal(feedRows.length, 28);
  const view = feedProgressGate({ rows: feedRows.length, availableRows: feedRows.length, liveProgress: false, isNewSearchPending: false });
  assert.equal(view, 'rows');
});

test('a filter that hides every row is never reported as "nothing found"', () => {
  const view = feedProgressGate({ rows: 0, availableRows: 26, liveProgress: false, isNewSearchPending: false, filtersActive: true });
  assert.equal(view, 'filtered');
});

test('an empty feed while the engine is still answering stays on the progress panel', () => {
  assert.equal(feedProgressGate({ rows: 0, availableRows: 0, liveProgress: true, isNewSearchPending: false }), 'progress');
  assert.equal(feedProgressGate({ rows: 0, availableRows: 0, liveProgress: false, isNewSearchPending: true }), 'progress');
});

test('the empty state is only reachable when the search settled with genuinely nothing', () => {
  assert.equal(feedProgressGate({ rows: 0, availableRows: 0, liveProgress: false, isNewSearchPending: false }), 'empty');
});

test('rows always win once they are on screen', () => {
  assert.equal(feedProgressGate({ rows: 5, availableRows: 5, liveProgress: false, isNewSearchPending: false }), 'rows');
});

test('a filter that hides real rows says so, whether or not more sources are still answering', () => {
  assert.equal(feedProgressGate({ rows: 0, availableRows: 12, liveProgress: true, isNewSearchPending: false }), 'filtered');
  assert.equal(feedProgressGate({ rows: 0, availableRows: 12, liveProgress: false, isNewSearchPending: false }), 'filtered');
});

test('a brand-new search still owns the feed over any leftover rows or filter states', () => {
  assert.equal(feedProgressGate({ rows: 20, availableRows: 20, liveProgress: false, isNewSearchPending: true }), 'progress');
  assert.equal(feedProgressGate({ rows: 0, availableRows: 20, liveProgress: true, isNewSearchPending: true }), 'progress');
});
