/**
 * Home showcase (owner spec 21 Oct): pure builders + honesty guards.
 * Real rows only; no item without a linkable destination ever renders.
 */
import { test } from 'node:test';
import assert from 'node:assert';

const mk = (id: string, merchant: string): any => ({ id, title: id, merchant, merchantLogo: null, image: 'https://x/i.jpg', price: 1, mrp: null, discountPct: null, rating: null, badge: null, url: '/api/out?t=x' });
import { mergeGoBig, statedDiscountPct, pctOf, saveOf, priceOf, itemFromOffer, itemFromAffiliate, imageFromAttributes, diversifyByMerchant, roundRobinSpread, techCategoryOf, merchantLogoCandidates, realMerchantDomain, nameDomainOf, destinationItem, finalizeSection, type OfferRow } from '../server/home/showcase';

test('itemFromOffer builds a masked, priced, honest showcase item', () => {
  const item = itemFromOffer({
    id: 7, vertical: 'ecommerce', title: 'boAt Airdopes 141', brand: 'boAt',
    attributes: { image_url: 'https://m.media-amazon.com/i.jpg' },
    vendor: 'Amazon', seller: 'Amazon', seller_url: 'https://www.amazon.in/dp/B0X',
    list_price: 1499, mandatory_total: 766, effective_price: 766, fetched_at: new Date().toISOString(),
  });
  assert.ok(item);
  assert.strictEqual(item!.merchant, 'Amazon');
  assert.strictEqual(item!.price, 766);
  assert.strictEqual(item!.mrp, 1499);
  assert.strictEqual(item!.discountPct, 49);
  assert.ok(item!.url.startsWith('/api/out?t='));
  assert.ok(!item!.url.includes('amazon.in'), 'the destination is masked inside the pointer');
});

test('itemFromOffer is honest: no destination or no price -> no item', () => {
  assert.strictEqual(itemFromOffer({
    id: 8, vertical: 'ecommerce', title: 'x', brand: null, attributes: null,
    vendor: null, seller: null, seller_url: null,
    list_price: null, mandatory_total: null, effective_price: null, fetched_at: new Date().toISOString(),
  }), null);
});

test('itemFromAffiliate masks the tracking URL and surfaces the coupon badge', () => {
  const item = itemFromAffiliate({
    id: 9, network_source: 'cuelinks', network_offer_id: '123', merchant_name: 'Myntra', merchant_logo: 'https://m/logo.png',
    title: 'Flat 20% off on Rs1999+', description: null, coupon_code: 'MYN20', discount_value: 20, discount_type: 'percent',
    affiliate_url: 'https://linksredirect.com/?cid=326794&url=https%3A%2F%2Fmyntra.com', original_url: 'https://www.myntra.com',
    categories: null, commission_note: 'Upto 6%',
  });
  assert.ok(item);
  assert.strictEqual(item!.badge, 'Code: MYN20');
  assert.ok(item!.url.startsWith('/api/out?t='));
});

test('imageFromAttributes reads single and gallery image keys, https only', () => {
  assert.strictEqual(imageFromAttributes({ image_url: 'https://x/y.jpg' }), 'https://x/y.jpg');
  assert.strictEqual(imageFromAttributes({ image_urls: ['http://insecure.jpg', 'https://good.jpg'] }), 'https://good.jpg');
  assert.strictEqual(imageFromAttributes('{"image_url":"https://z.jpg"}'), 'https://z.jpg');
  assert.strictEqual(imageFromAttributes({ image_url: 'http://nope.jpg' }), null);
  assert.strictEqual(imageFromAttributes(null), null);
});

test('merchant spread: a single-source batch never fills a section (owner 22 Oct)', () => {
  // 30 freshest rows all from Myntra, as production served before the fix.
  const oneMerchant = Array.from({ length: 30 }, (_, i) => mk(`m${i}`, 'Myntra'));
  const spread = diversifyByMerchant(oneMerchant, 3, 12);
  assert.strictEqual(spread.length, 3); // only maxPerMerchant from the sole seller
});

test('merchant spread: round-robins every present seller', () => {
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => mk(`a${i}`, 'Amazon')),
    ...Array.from({ length: 10 }, (_, i) => mk(`f${i}`, 'Flipkart')),
    ...Array.from({ length: 10 }, (_, i) => mk(`n${i}`, 'Nykaa')),
  ];
  // 3 sellers x max 3 each = 9 honest items; never more from one seller
  const spread = diversifyByMerchant(pool, 3, 12);
  assert.strictEqual(spread.length, 9);
  const counts = new Map<string, number>();
  for (const it of spread) counts.set(it.merchant, (counts.get(it.merchant) || 0) + 1);
  assert.strictEqual(counts.get('Amazon'), 3); // every seller gets even slots
  assert.strictEqual(counts.get('Flipkart'), 3);
  assert.strictEqual(counts.get('Nykaa'), 3);
  // and with four sellers the section reaches the full 12 (3 each).
  const pool4 = [...pool, ...Array.from({ length: 10 }, (_, i) => mk(`r${i}`, 'Reliance Digital'))];
  assert.strictEqual(diversifyByMerchant(pool4, 3, 12).length, 12);
});


test('coupon logo chain never uses the redirect host (owner 22 Oct live bug)', () => {
  // Live production rows: original_url is linksredirect.com (Cuelinks redirect),
  // which used to hand EVERY card the network's logo.
  const row: any = {
    id: 1, network_source: 'cuelinks', network_offer_id: 'x', merchant_name: 'Nykaa Fashion',
    merchant_logo: null, title: 't', description: null, coupon_code: 'X', discount_value: 10,
    discount_type: 'percent', affiliate_url: 'https://linksredirect.com/?cid=1', original_url: 'https://linksredirect.com/?cid=1',
    categories: null, commission_note: null,
  };
  const cands = merchantLogoCandidates(row);
  assert.ok(cands.length >= 2);
  assert.ok(!cands.some((c) => c.includes('linksredirect')), 'redirect host must never be a logo source');
  assert.ok(cands[0].includes('icons.duckduckgo.com/ip3/nykaafashion.com.ico')); // name-derived real merchant
  assert.ok(!cands.some((c) => c.includes('clearbit')), 'clearbit is DNS-dead, never ship it');
  assert.ok(cands.some((c) => c.includes('google.com/s2/favicons')), 'google fallback present');
  // a REAL merchant url host beats the name-derived domain
  const row2 = { ...row, original_url: 'https://www.jockey.in/coupon', merchant_name: 'Jockey India' };
  assert.strictEqual(realMerchantDomain([row2.original_url, row2.affiliate_url]), 'jockey.in');
  // registry logo wins over everything
  const row3 = { ...row, merchant_logo: 'https://cdn.example/logo.png' };
  assert.deepStrictEqual(merchantLogoCandidates(row3), ['https://cdn.example/logo.png']);
  // itemFromAffiliate carries the resolved logo through to image
  const item = itemFromAffiliate(row, 'https://icons.duckduckgo.com/ip3/nykaafashion.com.ico');
  assert.strictEqual(item!.image, 'https://icons.duckduckgo.com/ip3/nykaafashion.com.ico');
  // name domain derivation
  assert.strictEqual(nameDomainOf('AJIO GRAM'), 'ajiogram.com');
  assert.strictEqual(nameDomainOf(''), null);
});


test('destinationItem: real fare + real hotel photo -> card; missing data -> honest null', () => {
  const F = (id: number, title: string, price: number, agoDays = 1): OfferRow => ({
    id, vertical: 'flights', title, brand: null, attributes: {}, vendor: 'Ixigo', seller: 'Ixigo',
    seller_url: 'https://www.ixigo.com/search/f/1', list_price: null, mandatory_total: price,
    effective_price: price, validation_status: 'PARTIAL', location_city: 'Indore',
    fetched_at: new Date(Date.now() - agoDays * 86_400_000).toISOString(),
  });
  const H = (id: number, title: string, city: string, agoDays = 1): OfferRow => ({
    id, vertical: 'hotels', title, brand: null, attributes: { image_url: 'https://img.example/h.jpg' },
    vendor: 'Agoda', seller: 'Agoda', seller_url: 'https://www.agoda.com/x', list_price: null,
    mandatory_total: 3000, effective_price: 2800, validation_status: 'VALID', location_city: city,
    fetched_at: new Date(Date.now() - agoDays * 86_400_000).toISOString(),
  });

  const goa = { name: 'Goa', keys: ['goa'] };
  const flights = [F(1, 'IndiGo 6E-123 · Indore → Goa', 4599), F(2, 'Air India AI-5 · Indore → Delhi', 6000)];
  const hotels = [H(1, 'Royal Orchid Beach Resort', 'Goa'), H(2, 'Some Indore Hotel', 'Indore')];

  const item = destinationItem(goa, flights, hotels);
  assert.ok(item, 'goa has a fare and a hotel photo');
  assert.strictEqual(item!.price, 4599); // cheapest recorded fare wins
  assert.strictEqual(item!.image, 'https://img.example/h.jpg'); // real hotel art
  assert.strictEqual(item!.launch!.vertical, 'flights');
  assert.strictEqual(item!.launch!.query, 'to Goa');
  assert.strictEqual(item!.url, ''); // no external link — in-app engine launch

  // No fare recorded -> no card (never invent a price)
  const mumbai = { name: 'Mumbai', keys: ['mumbai'] };
  assert.strictEqual(destinationItem(mumbai, flights, hotels), null);
  // Fare but no hotel art -> no card (card needs real art)
  const hotelsNoArt = hotels.map((h) => ({ ...h, attributes: {} }));
  assert.strictEqual(destinationItem(goa, flights, hotelsNoArt), null);
  // Stale fare (16d) -> no card (window widened 7->14d on 22 Oct for the min-6 rule)
  const stale = [F(1, 'IndiGo 6E-123 · Indore → Goa', 4599, 16)];
  assert.strictEqual(destinationItem(goa, stale, hotels), null);

  // Bengaluru spelling variant matches a Bangalore-titled fare
  const blr = { name: 'Bengaluru', keys: ['bengaluru', 'bangalore'] };
  const blrFlights = [F(3, 'IndiGo 6E-9 · Indore → Bangalore', 4999)];
  const blrHotels = [H(3, 'The Ritz-Carlton', 'Bangalore')];
  const blrItem = destinationItem(blr, blrFlights, blrHotels);
  assert.ok(blrItem, 'bangalore spelling variant matched');
});

// ---- Owner 22 Oct: "iss section mai laptop, fridge, tv... sb dikhao" ----
test('techCategoryOf buckets the tech section correctly', () => {
  assert.equal(techCategoryOf('HP 15 Ryzen 5 Laptop'), 'laptop');
  assert.equal(techCategoryOf('Samsung 55 inch QLED Smart TV'), 'tv');
  assert.equal('LG 260L Double Door Refrigerator', 'LG 260L Double Door Refrigerator');
  assert.equal(techCategoryOf('LG 260L Double Door Refrigerator'), 'appliance');
  assert.equal(techCategoryOf('Samsung Galaxy F07 Mobile'), 'phone');
  assert.equal(techCategoryOf('boAt Airdopes 141 Wireless Earbuds'), 'audio');
  assert.equal(techCategoryOf('Noise ColorFit Pro Smartwatch'), 'wearable');
});

test('roundRobinSpread caps per category and fills the grid across buckets', () => {
  const mk = (t: string) => ({ title: t, merchant: 'X', price: 100, badge: '', url: '' } as any);
  const phones = [mk('iPhone 17'), mk('Galaxy M07'), mk('Redmi 15C'), mk('vivo T5')];
  const laptops = [mk('HP Laptop'), mk('Acer Laptop'), mk('Lenovo Laptop'), mk('Asus Laptop')];
  const tvs = [mk('Sony Bravia TV'), mk('Xiaomi Smart TV')];
  // production-shaped pool: bigger than the 12-slot grid
  const bigPool = [
    ...Array.from({ length: 8 }, (_, i) => mk(`Samsung Galaxy M${i} Mobile`)),
    ...Array.from({ length: 4 }, (_, i) => mk(`HP Pavilion Laptop ${i}`)),
    ...Array.from({ length: 3 }, (_, i) => mk(`Xiaomi Smart TV ${i}`)),
    ...Array.from({ length: 3 }, (_, i) => mk(`LG Refrigerator ${i}`)),
    ...Array.from({ length: 3 }, (_, i) => mk(`boAt Airdopes ${i} Earbuds`)),
  ];
  const out = roundRobinSpread(bigPool, (it) => techCategoryOf(it.title), 2, 12);
  const per = {} as Record<string, number>;
  for (const it of out) per[techCategoryOf(it.title)] = (per[techCategoryOf(it.title)] || 0) + 1;
  assert.equal(out.length, 12, 'fills the full 12-slot grid');
  assert.ok((per.phone || 0) <= 3, 'phones cannot dominate the grid');
  assert.ok((per.laptop || 0) >= 2, 'laptops present');
  assert.ok((per.tv || 0) >= 2, 'TVs present');
  assert.ok((per.appliance || 0) >= 2, 'fridge/appliance present');
  assert.ok((per.audio || 0) >= 2, 'audio present');
});

// Owner 22 Oct home-page lineup: Go Big replaces Massive Discounts + Mega Savings.
test('mergeGoBig unions the pools, dedupes, ranks by savings, caps 12', () => {
  const mega = [
    mk('a', 'Flipkart'), mk('b', 'Amazon'),
  ];
  // patch prices onto the generic fixture: a=5000 savings, b=1200 savings
  mega[0].price = 5000; mega[0].mrp = 10000;
  mega[1].price = 8800; mega[1].mrp = 10000;
  const massive = [
    { ...mk('b', 'Amazon'), price: 8800, mrp: 10000 },  // same id -> deduped
    { ...mk('c', 'Croma'), price: 300, mrp: 500 },        // 40% off but small savings
  ];
  const out = mergeGoBig(mega, massive);
  assert.equal(out.length, 3, 'dedupe by id keeps one b');
  assert.equal(out[0].id, 'a', 'biggest absolute savings first');
  assert.ok(['b', 'c'].includes(out[1].id) && ['b', 'c'].includes(out[2].id));
  // cap check: 30 items -> 12
  const big = Array.from({ length: 30 }, (_, i) => ({ ...mk(`g${i}`, 'M'), price: 100 + i, mrp: 200 + i }));
  assert.equal(mergeGoBig(big, []).length, 12);
});

// Owner 22 Oct: MRP-less rows with a source-stated "19%" discount must still
// feed Go Big / Steals — honest fallback on the seller's own claim.
test('statedDiscountPct parses attributes JSON/object; skips "up to" claims', () => {
  assert.equal(statedDiscountPct('{"discount":"19%"}'), 19);
  assert.equal(statedDiscountPct({ discount: 25 }), 25);
  assert.equal(statedDiscountPct({ discount_pct: '33 %' }), 33);
  assert.equal(statedDiscountPct('{"discount":"Up to 50%"}'), 0, 'up-to claims are not attributable');
  assert.equal(statedDiscountPct(null), 0);
  assert.equal(statedDiscountPct('{"discount":"0%"}'), 0);
  assert.equal(statedDiscountPct('{"discount":"197%"}'), 0, 'nonsense claims rejected');
});

test('pctOf/saveOf fall back to stated % when list_price is missing', () => {
  const row = {
    id: 41, vertical: 'ecommerce', title: 't', brand: null,
    attributes: '{"discount":"19%"}', vendor: 'Flipkart', seller: 'Flipkart',
    seller_url: 'https://f/dp', list_price: null, mandatory_total: 500,
    effective_price: 500, fetched_at: new Date().toISOString(),
  } as unknown as OfferRow;
  assert.equal(priceOf(row), 500);
  assert.equal(pctOf(row), 0.19);
  assert.equal(saveOf(row), 95);
  // MRP present -> strike-through math wins over the stated %
  const withMrp = { ...row, list_price: 1000 } as OfferRow;
  assert.equal(pctOf(withMrp), 0.5);
  assert.equal(saveOf(withMrp), 500);
});

test('finalizeSection tops a thin section back up to the min-6 (owner 22 Oct)', () => {
  // 8 real candidates from ONE seller: diversify caps at 3, the min-6 rule
  // relaxes the per-merchant cap using the same honest rows — never invents.
  const pool = Array.from({ length: 8 }, (_, i) => mk(`x${i}`, 'Cleartrip'));
  const out = finalizeSection(pool, 3, 12, 6);
  assert.strictEqual(out.length, 6);
  // and a healthy multi-seller pool still caps at 3 per merchant / 12 total
  const mixed = [
    ...Array.from({ length: 6 }, (_, i) => mk(`a${i}`, 'Agoda')),
    ...Array.from({ length: 6 }, (_, i) => mk(`b${i}`, 'Booking.com')),
    ...Array.from({ length: 6 }, (_, i) => mk(`c${i}`, 'Cleartrip')),
    ...Array.from({ length: 6 }, (_, i) => mk(`d${i}`, 'OYO')),
  ];
  const spread = finalizeSection(mixed, 3, 12, 6);
  assert.strictEqual(spread.length, 12);
  const counts = new Map<string, number>();
  for (const it of spread) counts.set(it.merchant, (counts.get(it.merchant) || 0) + 1);
  for (const c of counts.values()) assert.ok(c <= 3, 'never more than maxPerMerchant when the pool is healthy');
});

test('finalizeSection keeps honesty when fewer than 6 candidates exist', () => {
  const thin = [mk('a', 'Agoda'), mk('b', 'Cleartrip'), mk('c', 'Booking.com')];
  assert.strictEqual(finalizeSection(thin, 3, 12, 6).length, 3); // only real rows
});

test('destinationItem prefers verified-live hotel art (owner 22 Oct: no initials text)', () => {
  const F = (id: number, title: string, price: number, agoDays: number): OfferRow => ({
    id, vertical: 'flights', title, brand: null, attributes: null,
    vendor: 'Ixigo', seller: 'Ixigo', seller_url: 'https://www.ixigo.com/',
    list_price: price, mandatory_total: price, effective_price: price,
    fetched_at: new Date(Date.now() - agoDays * 86400000).toISOString(),
  });
  const H = (id: number, title: string, img: string, agoDays: number): OfferRow => ({
    id, vertical: 'hotels', title, brand: null, attributes: { image_url: img },
    vendor: 'Cleartrip', seller: 'Cleartrip', seller_url: 'https://www.cleartrip.com/',
    list_price: 4200, mandatory_total: 4200, effective_price: 4200,
    fetched_at: new Date(Date.now() - agoDays * 86400000).toISOString(),
  });
  const flights = [F(1, 'IndiGo 6E-123 · Indore → Goa', 4599, 1)];
  const hotels = [
    H(10, 'Goa Dead-CDN Resort', 'https://dead.cdn.invalid/a.jpg', 2),   // 404s from the browser
    H(11, 'Goa Live Beach Homestay', 'https://pix8.agoda.net/hotels/1.jpg', 2), // verified live
  ];
  const live = new Set(['https://pix8.agoda.net/hotels/1.jpg']);
  const card = destinationItem({ name: 'Goa', keys: ['goa'] }, flights, hotels, live);
  assert.ok(card, 'card renders from the live-art hotel');
  assert.strictEqual(card!.image, 'https://pix8.agoda.net/hotels/1.jpg');
  // without the verified set the old behavior (first real-art row) is kept,
  // so the sync unit path (liveUrls undefined) is unchanged.
  const first = destinationItem({ name: 'Goa', keys: ['goa'] }, flights, hotels);
  assert.strictEqual(first!.image, 'https://dead.cdn.invalid/a.jpg');
});

test('destinationItem matches IATA codes as whole words in flight titles', () => {
  const F = (id: number, title: string, price: number): OfferRow => ({
    id, vertical: 'flights', title, brand: null, attributes: null,
    vendor: 'Ixigo', seller: 'Ixigo', seller_url: 'https://www.ixigo.com/',
    list_price: price, mandatory_total: price, effective_price: price,
    fetched_at: new Date(Date.now() - 86400000).toISOString(),
  });
  const H = (id: number, img: string): OfferRow => ({
    id, vertical: 'hotels', title: 'Pune Grand', brand: null, attributes: { image_url: img },
    vendor: 'Cleartrip', seller: 'Cleartrip', seller_url: 'https://www.cleartrip.com/',
    list_price: 3200, mandatory_total: 3200, effective_price: 3200,
    fetched_at: new Date(Date.now() - 86400000).toISOString(),
  });
  // Flight titles carry the airport code, not always the city name.
  const card = destinationItem({ name: 'Pune', keys: ['pune'], iata: 'pnq' },
    [F(1, 'IndiGo 6E-99 · Indore → PNQ', 2899)], [H(2, 'https://pix8.agoda.net/p.jpg')]);
  assert.ok(card, 'IATA code matched the fare');
  assert.strictEqual(card!.price, 2899);
  // Word-boundary guard: a title that merely CONTAINS the letters does not match.
  const none = destinationItem({ name: 'Pune', keys: ['pune'], iata: 'pnq' },
    [F(3, 'Cheap flight to PunjabiBagh', 1999)], [H(4, 'https://pix8.agoda.net/p.jpg')]);
  assert.strictEqual(none, null, 'no city-name fare and no whole-word PNQ -> no card');
});
