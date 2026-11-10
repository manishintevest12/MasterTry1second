import test from 'node:test';
import assert from 'node:assert/strict';
import { sitemapXml, sitemapPriority } from '../server/seo/sitemap';

test('priority expresses importance instead of giving every deep URL 0.8', () => {
  assert.equal(sitemapPriority('/'), '1.0');
  assert.equal(sitemapPriority('/flights'), '0.9');
  assert.equal(sitemapPriority('/best/flights'), '0.8', 'money category answer');
  assert.equal(sitemapPriority('/guides/best-price-comparison-website-india'), '0.8');
  assert.equal(sitemapPriority('/hotels/mumbai'), '0.7', 'city page');
  assert.equal(sitemapPriority('/bus/chennai-to-madurai-bus'), '0.7', 'route page');
  assert.equal(sitemapPriority('/best/flights/maharashtra'), '0.5', 'state answer is not crawl priority');
  assert.equal(sitemapPriority('/product/iphone-15-128gb'), '0.4');
});

test('lastmod is not "today" for pages whose content only changes on release', () => {
  const xml = sitemapXml();
  const blocks = xml.split('<url>').slice(1);
  const byPath = (needle: string) => blocks.find((b) => b.includes(needle)) || '';
  const today = new Date().toISOString().slice(0, 10);
  const stateBlock = byPath('/best/hotels/maharashtra');
  assert.ok(stateBlock, 'state answer must be in the sitemap');
  const stateLastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(stateBlock)![1];
  const releaseLike = !/<changefreq>daily<\/changefreq>/.test(stateBlock);
  assert.ok(releaseLike, 'state answers are weekly, not daily churn');
  assert.ok(stateLastmod <= today);
  const cityBlock = byPath('/hotels/mumbai');
  assert.ok(/<changefreq>daily<\/changefreq>/.test(cityBlock), 'city page keeps a daily churn signal');
});

test('the sitemap is an index of three buckets, so coverage is reported per group', async () => {
  const { sitemapBucketOf, sitemapIndexXml, sitemapXml } = await import('../server/seo/sitemap');
  const { listSeoPaths } = await import('../server/seo/data');
  const paths = listSeoPaths();
  const cities = paths.filter((p) => sitemapBucketOf(p) === 'cities');
  const core = paths.filter((p) => sitemapBucketOf(p) === 'core');
  assert.ok(cities.length > 2500, `every city page goes to the cities bucket, got ${cities.length}`);
  assert.ok(core.includes('/'), 'homepage stays in core');
  assert.ok(core.includes('/best/hotels/maharashtra'), 'state answers stay in core');
  assert.ok(cities.includes('/hotels/kozhikode'));
  assert.equal(sitemapBucketOf('/product/iphone-15-128gb'), 'products');
  assert.equal(sitemapBucketOf('/flights/indore-to-new-delhi-flights'), 'core', 'route pages are not cities');

  const index = sitemapIndexXml({ core: core.length, cities: cities.length, products: 0 });
  assert.match(index, /<sitemapindex/);
  assert.match(index, /\/sitemap-core\.xml/);
  assert.match(index, /\/sitemap-cities\.xml/);
  assert.doesNotMatch(index, /\/sitemap-products\.xml/, 'an empty bucket is not advertised');

  const cityXml = sitemapXml(cities);
  assert.match(cityXml, /<urlset/);
  assert.doesNotMatch(cityXml, /\/best\//, 'the cities file carries no answer pages');
});
