import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafePublicUrl, extractUrl, titleFromSlug, cleanTitle, parseProductHtml, merchantFor, stripComparisonBoilerplate, isMerchantNameTitle } from '../server/lens/productLink';
import { interpretAssistantQuestion, parseSpokenDate } from '../server/lens/assistantIntent';

test('lens: private/local/odd URLs are refused (SSRF guard)', () => {
  for (const bad of ['http://localhost/x', 'http://127.0.0.1/a', 'http://10.0.0.5/a', 'http://192.168.1.2/a', 'http://169.254.169.254/latest/meta-data', 'http://172.20.0.1/a', 'ftp://example.com/a', 'javascript:alert(1)', 'https://user:pw@amazon.in/x', 'http://intranet/x', 'http://[::1]/x']) {
    assert.equal(isSafePublicUrl(bad).ok, false, bad);
  }
  assert.equal(isSafePublicUrl('https://www.flipkart.com/apple-iphone-17/p/itm1').ok, true);
});

test('lens: link pulled out of a pasted share blurb', () => {
  assert.equal(extractUrl('Check this deal! https://dl.flipkart.com/s/abc123, so cheap'), 'https://dl.flipkart.com/s/abc123');
  assert.equal(extractUrl('no link here'), null);
});

test('lens: merchant names', () => {
  assert.equal(merchantFor('www.amazon.in'), 'Amazon India');
  assert.equal(merchantFor('www.flipkart.com'), 'Flipkart');
  assert.equal(merchantFor('www.someshop.example'), 'someshop.example');
});

test('lens: product words recovered from URL slug when the page is bot-gated', () => {
  assert.equal(titleFromSlug(new URL('https://www.flipkart.com/apple-iphone-17-black-256-gb/p/itm9f3a2b1c4d5e6?pid=MOBX')), 'apple iphone 17 black 256 gb');
  assert.equal(titleFromSlug(new URL('https://www.amazon.in/Samsung-Galaxy-S24-Ultra-Titanium/dp/B0CS5XW6TN')), 'Samsung Galaxy S24 Ultra Titanium');
  assert.equal(titleFromSlug(new URL('https://www.amazon.in/dp/B0CS5XW6TN')), null);
});

test('lens: store boilerplate stripped from titles', () => {
  assert.equal(cleanTitle('Buy Apple iPhone 17 (Black, 256 GB) Online at Best Price | Flipkart.com'), 'Apple iPhone 17 (Black, 256 GB)');
  assert.equal(cleanTitle('Sony WH-1000XM5 Headphones: Amazon.in: Electronics'), 'Sony WH-1000XM5 Headphones');
});

test('lens: JSON-LD product wins and exposes the page price', () => {
  const html = `<html><head><title>x</title><script type="application/ld+json">{"@type":"Product","name":"boAt Airdopes 141","image":["https://img.example/a.jpg"],"offers":{"price":"999"}}</script></head></html>`;
  const p = parseProductHtml(html);
  assert.equal(p.title, 'boAt Airdopes 141');
  assert.equal(p.titleSource, 'json-ld');
  assert.equal(p.pagePrice, 999);
  assert.equal(p.image, 'https://img.example/a.jpg');
});

test('lens: og:title fallback; bot-wall titles are NOT treated as products', () => {
  assert.equal(parseProductHtml('<meta property="og:title" content="Nike Air Zoom Pegasus | Myntra">').title, 'Nike Air Zoom Pegasus');
  assert.equal(parseProductHtml('<title>Access Denied</title>').title, null);
  assert.equal(parseProductHtml('<title>Just a moment...</title>').title, null);
  assert.equal(parseProductHtml('<html></html>').titleSource, 'none');
});

test('assistant: Delhi to Mumbai flight -> flights', () => {
  const r = interpretAssistantQuestion('Delhi to Mumbai flight ka rate batao');
  assert.equal(r.vertical, 'flights');
  assert.equal(r.query, 'Delhi to Mumbai');
  assert.equal(r.understood, true);
});

test('assistant: Hinglish "kal" resolves to tomorrow', () => {
  const now = new Date(2026, 9, 13);
  const r = interpretAssistantQuestion('indore se bhopal bus kal', now);
  assert.equal(r.vertical, 'bus');
  assert.equal(r.query, 'Indore to Bhopal');
  assert.equal(r.date, '2026-10-14');
  assert.equal(parseSpokenDate('15 november ko', now), '2026-11-15');
});

test('assistant: other verticals route correctly', () => {
  assert.equal(interpretAssistantQuestion('hotels in goa').vertical, 'hotels');
  assert.match(interpretAssistantQuestion('hotels in goa').query, /goa/i);
  assert.equal(interpretAssistantQuestion('chicken biryani').vertical, 'food');
  assert.equal(interpretAssistantQuestion('personal loan interest rate').vertical, 'loans');
});

test('assistant: gibberish is honestly not understood, never guessed', () => {
  const r = interpretAssistantQuestion('qwertyuiop');
  assert.equal(r.understood, false);
  assert.equal(r.vertical, null);
  assert.equal(interpretAssistantQuestion('').understood, false);
});

import { istToday } from '../server/lens/assistantIntent';
test('assistant: "today" follows India time even when the server clock is still on the previous UTC day', () => {
  // 2026-10-13 21:00 UTC == 2026-10-14 02:30 IST
  const d = istToday(new Date(Date.UTC(2026, 9, 13, 21, 0, 0)));
  assert.equal(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, '2026-10-14');
});

import { isSameProduct, isAccessory } from '../server/lens/sameProduct';
test('same-product guard: accessories and other models are never "the cheapest iPhone"', () => {
  const pasted = 'Apple iPhone 17 (Black, 256 GB)';
  assert.equal(isSameProduct(pasted, 'Apple iPhone 17 256 GB Black'), true);
  assert.equal(isSameProduct(pasted, 'Apple iPhone 17 (Lavender, 256GB)'), true);
  assert.equal(isSameProduct(pasted, 'Gripp Slimfit Mag-Safe Case For Iphone 17 Back Cover'), false);
  assert.equal(isSameProduct(pasted, 'Apple iPhone 16 (Black, 256 GB)'), false);
  assert.equal(isSameProduct(pasted, 'Apple iPhone 17 (Black, 128 GB)'), false);
  assert.equal(isSameProduct(pasted, 'Apple 20W USB-C Power Adapter for iPhone'), false);
  assert.equal(isAccessory('Spigen Tempered Glass Screen Protector'), true);
  // pasting an accessory is allowed to match accessories
  assert.equal(isSameProduct('Spigen Rugged Armor Case for iPhone 17', 'Spigen Rugged Armor Case iPhone 17 Black'), true);
});

import { searchableTitle } from '../server/lens/productLink';
test('lens: keyword-stuffed marketplace titles shrink to brand + model (+ capacity)', () => {
  assert.equal(searchableTitle('boAt Airdopes 141/8, Low Latency, ENx Tech, 42HRS Battery, Bluetooth Earbuds (Bold Black)'), 'boAt Airdopes 141');
  assert.equal(searchableTitle('Apple iPhone 17 (Black, 256 GB)'), 'Apple iPhone 17 256GB');
  assert.equal(searchableTitle('Sony WH-1000XM5 Wireless Headphones'), 'Sony WH-1000XM5 Wireless Headphones');
});

test('tracker links: "Price History of X from Flipkart 2_224849352" keeps only the product', () => {
  assert.equal(stripComparisonBoilerplate('Price History of Apple iPhone 17 (Black, 256 GB) from Flipkart 2_224849352'), 'Apple iPhone 17 (Black, 256 GB)');
  assert.equal(stripComparisonBoilerplate('Apple iPhone 17 Price in India - Buy at Rs 86,999 | BuyHatke'), 'Apple iPhone 17');
  assert.equal(cleanTitle('Price History of Apple iPhone 17 (Black, 256 GB) from Flipkart 2_224849352'), 'Apple iPhone 17 (Black, 256 GB)');
});

test('tracker links: BuyHatke URL slug yields the product words without merchant/price tail', () => {
  const t = titleFromSlug(new URL('https://buyhatke.com/flipkart-apple-iphone-17-black-256-gb-price-in-india-2-224849352'));
  assert.equal(t, 'apple iphone 17 black 256 gb');
  assert.equal(merchantFor('www.buyhatke.com'), 'BuyHatke');
});

import { analyseDeal } from '../server/lens/dealScore';
test('deal score: no/short history gives NO score (never invented)', () => {
  const a = analyseDeal(86999, []);
  assert.equal(a.score, null);
  assert.equal(a.verdict, 'unknown');
  assert.equal(analyseDeal(86999, [{ price: 90000, capturedAt: '2026-10-01' }]).score, null);
});
test('deal score: at the all-time low and cheapest site scores high; at the high scores low', () => {
  const hist = [100000, 99000, 98000, 97000, 96000].map((p, i) => ({ price: p, capturedAt: `2026-09-${10 + i}` }));
  const great = analyseDeal(90000, hist, 90000);
  const bad = analyseDeal(100000, hist, 90000);
  assert.ok(great.score! >= 75, 'great=' + great.score);
  assert.ok(bad.score! < 35, 'bad=' + bad.score);
  assert.equal(great.allTimeLow, 90000);
  assert.equal(great.breakup.reduce((s, b) => s + b.pts, 0), great.score);
});

test('same-product guard: tier variants (Pro/Max/Plus/Mini) are different products', async () => {
  const { isSameProduct } = await import('../server/lens/sameProduct');
  assert.equal(isSameProduct('apple iphone 17 black 256 gb', 'Apple iPhone 17 Pro (Silver, 256 GB)'), false);
  assert.equal(isSameProduct('apple iphone 17 pro 256 gb', 'Apple iPhone 17 (Black, 256 GB)'), false);
  assert.equal(isSameProduct('apple iphone 17 black 256 gb', 'Apple iPhone 17 (Sage, 256 GB)'), true); // colour is a variant, not a tier
  assert.equal(isSameProduct('macbook air m3', 'MacBook Pro 14 M3'), false);
});

// A page whose only "title" is the merchant name (Amazon's bot-wall <title>) must NOT count as a product.
test('merchant-name title is rejected as a bot wall', () => {
  assert.ok(isMerchantNameTitle('Amazon.in', 'amazon.in', 'Amazon'));
  assert.ok(isMerchantNameTitle('Flipkart.com', 'flipkart.com', 'Flipkart'));
  assert.ok(!isMerchantNameTitle('Philips Airfryer HD9252/90', 'amazon.in', 'Amazon'));
  assert.ok(!isMerchantNameTitle(null, 'amazon.in', 'Amazon'));
});
