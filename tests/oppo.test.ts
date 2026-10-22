/**
 * Oppo India parser regression (22 Oct): two-stage browserless recipe.
 * Stage 1 — /in/search/?q=<term> is SSR'd ("Venus-Render") and embeds product
 * cards as JSON objects (title, buyLink, image); parseOppoSearch lifts every
 * buyLink object. Stage 2 — each PDP embeds per-variant schema.org objects
 * (name, sku, color, offers.price, offers.listPrice, availability InStock,
 * image[4 shots]); parseOppoPdp walks them and oppoItem() emits the gallery.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOppoSearch, parseOppoPdp, oppoItem, extractOppoProsePrice } from '../server/workers/parsers/oppo.ts';

const src: any = { id: 'w_ecom_oppo', name: 'Oppo', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 18, config: {}, rateLimit: { maxRequestsPerMinute: 8, maxConcurrency: 2 }, freshnessPolicy: {} };

function searchHtml(cards: any[]) {
  const objs = cards.map((c) => JSON.stringify(c)).join(',\n');
  return `<html><body><script>var x = [${objs}];</script>
<script>var junk = {"title":"not a product"};</script></body></html>`;
}

function pdpHtml(variants: any[]) {
  const objs = variants.map((v) => JSON.stringify(v)).join(',\n');
  return `<html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}
</script><script>var variants = [${objs}];</script></body></html>`;
}

function variant(name: string, sku: string, price: string, list: string, images: string[], inStock = true) {
  return {
    '@type': 'ProductVariant',
    name,
    sku,
    color: name.split(' ').slice(-2).join(' '),
    memory: '8 GB',
    storageCapacity: '256 GB',
    model: 'reno16-5g',
    image: images,
    offers: {
      '@type': 'Offer',
      url: 'https://www.oppo.com/in/product/reno16-5g.P.P1110156?sku=' + sku,
      price,
      priceCurrency: 'INR',
      listPrice: { '@type': 'PriceSpecification', price: list, priceCurrency: 'INR' },
      priceValidUntil: '2026-10-31',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}

test('oppo search: extracts buyLink cards, upgrades relative images, skips junk', () => {
  const html = searchHtml([
    { id: 'a', title: 'OPPO Reno16 5G', buyLink: 'https://www.oppo.com/in/product/reno16-5g.P.P1110156', image: '/content/dam/oppo/reno16/nav.png', tag: 'none', toStore: 'true' },
    { id: 'b', title: 'OPPO Find X9 Ultra', buyLink: 'https://www.oppo.com/in/product/oppo-find-x9-ultra.P.P111014', image: 'https://image.oppo.com/x.png', tag: 'hot' },
    { id: 'c', title: 'OPPO Magnetic Charger 2', link: 'https://www.oppo.com/in/accessories/mag', image: '/content/dam/oppo/mag.png' }, // no buyLink
    { id: 'a', title: 'OPPO Reno16 5G (dupe)', buyLink: 'https://www.oppo.com/in/product/reno16-5g.P.P1110156', image: '' },
  ]);
  const prods = parseOppoSearch(html);
  assert.equal(prods.length, 2);
  assert.equal(prods[0].title, 'OPPO Reno16 5G');
  assert.equal(prods[0].buyLink, 'https://www.oppo.com/in/product/reno16-5g.P.P1110156');
  assert.equal(prods[0].image, 'https://www.oppo.com/content/dam/oppo/reno16/nav.png');
  assert.equal(prods[1].image, 'https://image.oppo.com/x.png');
  assert.deepEqual(parseOppoSearch('<html>empty</html>'), []);
});

test('oppo pdp: variants parse with price, mrp, stock, gallery; first in-stock wins', () => {
  const html = pdpHtml([
    variant('OPPO Reno16 5G 8GB + 256GB Starry White', '5011110339', '66999', '89999', [
      'https://opsg-img-cdn-gl.heytapimg.com/epb/202607/02/a.png',
      'https://opsg-img-cdn-gl.heytapimg.com/epb/202607/02/b.png',
      'https://opsg-img-cdn-gl.heytapimg.com/epb/202607/02/c.png',
      'https://opsg-img-cdn-gl.heytapimg.com/epb/202607/02/d.png',
    ]),
    variant('OPPO Reno16 5G 12GB + 256GB Starry White', '5011110340', '72999', '99999', [
      'https://opsg-img-cdn-gl.heytapimg.com/epb/202607/02/e.png',
    ]),
    variant('OPPO Reno16 5G 8GB + 256GB OOS colour', '5011110341', '60999', '89999', [], false),
  ]);
  const variants = parseOppoPdp(html);
  assert.equal(variants.length, 3);
  const v = variants[0];
  assert.equal(v.name, 'OPPO Reno16 5G 8GB + 256GB Starry White');
  assert.equal(v.sku, '5011110339');
  assert.equal(v.price, 66999);
  assert.equal(v.listPrice, 89999);
  assert.equal(v.inStock, true);
  assert.equal(v.images.length, 4);
  assert.equal(v.color, 'Starry White');
  assert.equal(variants[2].inStock, false);
  assert.deepEqual(parseOppoPdp('<html>no variants</html>'), []);
});

test('oppo item: hero + gallery union, listPrice only above price, variant count', () => {
  const prod = { title: 'OPPO Reno16 5G', buyLink: 'https://www.oppo.com/in/product/reno16-5g.P.P1110156', image: 'https://www.oppo.com/hero.png', tag: 'none' };
  const v = {
    name: 'OPPO Reno16 5G 8GB + 256GB Starry White', sku: '5011110339', price: 66999,
    listPrice: 89999, inStock: true, color: 'Starry White', storage: '256 GB', model: 'reno16-5g',
    images: ['https://cdn/a.png', 'https://cdn/b.png', 'https://cdn/c.png'],
    variantCount: 1,
  };
  const it = oppoItem(src, 'https://www.oppo.com/in/search/?q=phone', prod, v, 5);
  assert.equal(it.title, 'OPPO Reno16 5G');
  assert.equal(it.brand, 'Oppo');
  assert.equal(it.price, 66999);
  assert.equal(it.listPrice, 89999);
  assert.equal(it.seller, 'Oppo (oppo.com/in)');
  assert.equal(it.sellerUrl, prod.buyLink);
  assert.equal(it.identifiers?.sku, '5011110339');
  assert.equal(it.availability, 'in_stock');
  const imgs = String(it.attributes?.image_urls).split('|');
  assert.deepEqual(imgs, ['https://www.oppo.com/hero.png', 'https://cdn/a.png', 'https://cdn/b.png', 'https://cdn/c.png']);
  assert.equal(it.attributes?.variant_count, '5');
  assert.equal(it.attributes?.storage, '256 GB');
  // listPrice below price -> dropped
  const v2 = { ...v, listPrice: 59999 };
  const it2 = oppoItem(src, 'u', prod, v2, 1);
  assert.equal(it2.listPrice, undefined);
});


test('oppo prose fallback: FAQ/description India-price extraction', () => {
  const ultra = extractOppoProsePrice('<script>{"desc":"The Find X9 Ultra is ₹1,69,999 in a single India configuration (12GB + 512GB), in Tundra Umber and Canyon Orange."}</script>');
  assert.ok(ultra);
  assert.equal(ultra.price, 169999);
  assert.ok(ultra.matched.includes('1,69,999'));

  const x9s = extractOppoProsePrice('Priced from ₹79,999 (12GB+256GB; ₹89,999 for 12GB+512GB), in Sunset Orange and Lavender Sky.');
  assert.ok(x9s);
  assert.equal(x9s.price, 79999);

  // no price prose, or only junk sub-1000 amounts -> null
  assert.equal(extractOppoProsePrice('<html>no prose here</html>'), null);
  assert.equal(extractOppoProsePrice('Priced from ₹99'), null);
  // unrelated ₹ mentions (livestream coupon) must not match
  assert.equal(extractOppoProsePrice('Find X9 Series up to ₹10000 OFF in Livestream!'), null);
});
