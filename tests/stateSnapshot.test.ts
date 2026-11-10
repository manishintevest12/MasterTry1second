import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCityDiverseRows, renderSnapshotHtml, selectSnapshotRows } from '../server/seo/liveSnapshot';

test('state answer snapshot: rows are labelled with their city and picked cheapest-first', () => {
  const rows = [
    { title: 'Hotel A · Mumbai', seller: 'Cleartrip', price: 4200, url: null },
    { title: 'Hotel B · Pune', seller: 'MakeMyTrip', price: 3100, url: null },
    { title: 'Hotel C · Nagpur', seller: 'Cleartrip', price: 1800, url: null },
  ];
  const byCity = [
    [rows[0]], [rows[1]], [rows[2]],
  ];
  const picked = pickCityDiverseRows(byCity, 6);
  assert.equal(picked.length, 3, 'one row per city is kept, even when the same seller repeats');
  assert.deepEqual(picked.map((r) => r.title), ['Hotel A · Mumbai', 'Hotel B · Pune', 'Hotel C · Nagpur'],
    'cities appear in the state list order, each with its own cheapest row');
  assert.ok(picked.every((r) => r.title.includes('·')), 'every row names its city');
});

test('snapshot heading comes from the page, not a hardcoded string', () => {
  const html = renderSnapshotHtml({
    rows: [{ title: 'Hotel C · Nagpur', seller: 'Cleartrip', price: 1800, url: null }],
    updatedAt: new Date().toISOString(),
    heading: 'Latest verified prices in Maharashtra',
  });
  assert.match(html, /Latest verified prices in Maharashtra/);
  assert.match(html, /₹1,800/);
  assert.equal(renderSnapshotHtml(null), '', 'no rows renders nothing at all');
});

test('a state page never shows one city twice before the others appear', () => {
  const mumbai = [
    { title: 'Hotel A · Mumbai', seller: 'Cleartrip', price: 4200, url: null },
    { title: 'Hotel D · Mumbai', seller: 'Cleartrip', price: 2200, url: null },
  ];
  const pune = [{ title: 'Hotel B · Pune', seller: 'Cleartrip', price: 3100, url: null }];
  const picked = pickCityDiverseRows([mumbai, pune], 6);
  assert.deepEqual(picked.map((r) => r.title), ['Hotel D · Mumbai', 'Hotel B · Pune', 'Hotel A · Mumbai']);
  assert.equal(selectSnapshotRows(mumbai, '/best/hotels/maharashtra', 6).length, 1, 'the single-page rule still dedupes by seller');
});

test('the answer page HTML has the anchor the price block is inserted into', async () => {
  const { resolveAnswerPage, renderAnswerHtml } = await import('../server/seo/answerPages');
  const page = resolveAnswerPage('/best/hotels/maharashtra');
  assert.ok(page, 'state answer page resolves');
  const html = renderAnswerHtml(page!);
  assert.ok(html.includes('</main>'), 'the server route inserts the verified-price block before </main>');
  assert.ok(html.includes('</head>'), 'and the ItemList JSON-LD before </head>');
});
