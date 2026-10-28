/**
 * Indexable result snapshots (owner 28 Oct): "results pages index kar de to fast hoga?"
 * Indexing alone does not speed anything up — cached prices in the FIRST HTML byte do, and
 * crawlable prices are what earn the traffic. These tests pin the honesty rules:
 *   - route/city pages only ever show rows that mention that route/city
 *   - one row per seller, cheapest first, never an invented price
 *   - nothing at all when the catalogue is empty
 */
import { selectSnapshotRows, renderSnapshotHtml, snapshotJsonLd, type SnapshotRow } from '../server/seo/liveSnapshot';

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { cond ? passed++ : (failed++, console.error(`FAIL ${name}`)); };

const rows: SnapshotRow[] = [
  { title: 'Indore to Delhi flight 6E 2041', seller: 'IndiGo', price: 4280 },
  { title: 'Indore to Delhi flight AI 803', seller: 'Air India', price: 4650 },
  { title: 'Indore to Delhi flight 6E 5002', seller: 'IndiGo', price: 4120 },
  { title: 'Mumbai to Goa flight UK 841', seller: 'Vistara', price: 3100 },
  { title: 'Delhi to Dubai flight EK 511', seller: 'Emirates', price: 18900 },
];

const picked = selectSnapshotRows(rows, '/flights/indore-to-delhi-flights');
t('route page keeps only rows for that route', picked.every((r) => /indore/i.test(r.title) && /delhi/i.test(r.title)));
t('wrong-route rows are dropped', picked.some((r) => /mumbai|dubai/i.test(r.title)) === false);
t('cheapest first', picked[0].price === 4120);
t('one row per seller', new Set(picked.map((r) => r.seller)).size === picked.length);
t('empty catalogue yields nothing', selectSnapshotRows([], '/hotels').length === 0);

const snap = { rows: picked, updatedAt: '2026-10-28T06:00:00.000Z' };
const html = renderSnapshotHtml(snap);
t('html carries real prices', html.includes('₹4,120') && html.includes('IndiGo'));
t('html stamps freshness', /Verified .*2026/.test(html));
t('html escapes merchant text', renderSnapshotHtml({ rows: [{ title: '<script>x</script>', seller: 'A&B', price: 10 }], updatedAt: snap.updatedAt }).includes('&lt;script&gt;'));
t('no html when empty', renderSnapshotHtml(null) === '' && renderSnapshotHtml({ rows: [], updatedAt: snap.updatedAt }) === '');

const ld = snapshotJsonLd(snap, '/flights/indore-to-delhi-flights');
t('json-ld is emitted with INR offers', Boolean(ld && ld.includes('"priceCurrency":"INR"') && ld.includes('ItemList')));
t('no json-ld when empty', snapshotJsonLd(null, '/flights') === null);

console.log(`seoSnapshots: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

// 5. Product URLs must be sitemap-safe slugs (owner 28 Oct: indexable product pages)
import { productSlug, sitemapXml } from '../server/seo/sitemap';
t('slug is url-safe', productSlug('Apple iPhone 15 (128GB, Black)') === 'apple-iphone-15-128gb-black');
t('slug never ends with a dash', productSlug('Boat Airdopes 141 - ') === 'boat-airdopes-141');
t('sitemap carries product pages', sitemapXml(['/product/apple-iphone-15-128gb']).includes('/product/apple-iphone-15-128gb'));
if (failed) { console.error(`seo extras: ${failed} failed`); process.exit(1); }
console.log(`seo extras ok: ${passed} total`);
