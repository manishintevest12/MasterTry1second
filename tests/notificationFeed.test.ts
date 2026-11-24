import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_NOTES, featureRow, dealRow } from '../server/notifications/feed';
import { isProductPath, isVerticalPath } from '../src/utils/verticalRoutes';

/**
 * OWNER 23 Nov: "bell notification jo hai app website mai usme kuch v notification ni aata jaise maan lo koi new
 * feature update kiye tho notification aana chaiye yaa koi deal wagera ka".
 *
 * The bell was empty because nothing ever wrote to it. These tests pin the two producers that now do: the shipped
 * feature notes (our own product claims, written by hand) and the daily deal (real deal data or nothing at all).
 */

test('every feature note is a real, dated, unique entry', () => {
  const keys = new Set<string>();
  const titles = new Set<string>();
  for (const note of FEATURE_NOTES) {
    assert.ok(note.key && !keys.has(note.key), `duplicate key ${note.key}`);
    assert.ok(note.title && !titles.has(note.title), `duplicate title ${note.title}`);
    keys.add(note.key);
    titles.add(note.title);
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(note.date <= new Date().toISOString().slice(0, 10), `future date on ${note.key}`);
    assert.ok(note.body.length > 20, `body too thin on ${note.key}`);
  }
});

test('a feature note becomes a broadcast row with a safe link', () => {
  const row = featureRow({
    key: 'x', date: '2026-11-23', title: 'T', body: 'B',
    ctaUrl: 'https://play.google.com/store/apps/details?id=com.try1second.try1second',
  });
  assert.equal(row.kind, 'feature');
  assert.equal(row.ctaUrl, 'https://play.google.com/store/apps/details?id=com.try1second.try1second');
  // javascript: and other schemes are refused, never stored
  assert.equal(featureRow({ key: 'y', date: '2026-11-23', title: 'T', body: 'B', ctaUrl: 'javascript:alert(1)' }).ctaUrl, null);
  assert.equal(featureRow({ key: 'z', date: '2026-11-23', title: 'T', body: 'B' }).ctaUrl, null);
});

test('a deal with no title is refused — no invented notifications', () => {
  assert.equal(dealRow({}), null);
  assert.equal(dealRow({ title: '   ' }), null);
  assert.equal(dealRow(null), null);
});

test('a real deal becomes a notification carrying its own title, merchant and link', () => {
  const row = dealRow({
    title: 'Bank Offer Upto ₹2,500.00 discount on select Credit Cards',
    merchantName: 'Amazon',
    description: 'Listed on this Amazon product page.',
    imageUrl: 'https://www.google.com/s2/favicons?domain=amazon.in&sz=128',
    goUrl: '/api/out?t=abc',
  });
  assert.ok(row);
  assert.equal(row!.kind, 'deal');
  assert.match(row!.title, /^Deal today: Bank Offer/);
  assert.match(row!.body, /^Amazon — /);
  assert.equal(row!.seller, 'Amazon');
  assert.equal(row!.ctaUrl, '/api/out?t=abc');
  assert.equal(row!.image, 'https://www.google.com/s2/favicons?domain=amazon.in&sz=128');
});

test('a deal image or link that is not https is dropped, not stored', () => {
  const row = dealRow({ title: 'X', imageUrl: 'http://insecure/x.jpg', goUrl: 'http://insecure/y' });
  assert.ok(row);
  assert.equal(row!.image, null);
  assert.equal(row!.ctaUrl, null);
});

test('long text is cut to the column sizes instead of failing the insert', () => {
  const row = dealRow({ title: 'x'.repeat(500), description: 'y'.repeat(2000), merchantName: 'Z' });
  assert.ok(row);
  assert.ok(row!.title.length <= 200);
  assert.ok(row!.body.length <= 1000);
});

/**
 * OWNER 24 Nov: "notification pr click kr ke v redirection ho uss notification se related. abhi sirf notification
 * dikhta hai pr ye samj ni aata usko kaise kaha se le". A note whose link the readers cannot route is exactly that
 * dead tap: the drawer used to open '/?vertical=flights' in a new tab, and the site's reader only understands
 * '/flights' or '#vertical=flights', so the visitor landed on Home. This pins the link shape.
 */
test('every feature note links to a screen the site and the app can actually route', () => {
  for (const note of FEATURE_NOTES) {
    const row = featureRow(note);
    assert.ok(row.ctaUrl, `note ${note.key} has no destination`);
    const link = String(row.ctaUrl);
    assert.ok(!/\?vertical=/.test(link), `${note.key} uses the query form the readers ignore`);
    if (/^https:\/\//i.test(link)) continue; // a real external page, e.g. the Play listing
    const path = link.split(/[?#]/)[0] || '/';
    assert.ok(
      path === '/' || isVerticalPath(path) || isProductPath(path),
      `${note.key} points at ${link}, which is neither Home, a vertical, nor a product page`,
    );
  }
});
