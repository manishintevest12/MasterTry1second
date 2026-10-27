import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePromoOffer, isPromoLive, cleanDomain, cleanSlug, PROMO_KINDS } from '../server/marketing/promoOffers';
import { buildXlsx, crc32, zipStore } from '../server/admin/xlsx';
import zlib from 'node:zlib';

// Owner 27 Oct: admin must add coupons/offers/cashback manually with photo + affiliate
// link, and the /redirect page shows them with a Copy button.

test('a coupon needs a code, an offer does not', () => {
  const noCode = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'coupon', title: 'Flat ₹500 off hotels' });
  assert.equal(noCode.ok, false);
  assert.match(String(noCode.error), /code/i);
  const offer = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Flat ₹500 off hotels' });
  assert.equal(offer.ok, true, offer.error);
  const cash = validatePromoOffer({ merchant_slug: 'flipkart', merchant_domain: 'flipkart.com', kind: 'cashback', title: '10% cashback on mobiles' });
  assert.equal(cash.ok, true, cash.error);
});

test('kind must be coupon / offer / cashback', () => {
  const bad = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'loot', title: 'Something big' });
  assert.equal(bad.ok, false);
  for (const k of PROMO_KINDS) {
    assert.equal(validatePromoOffer({ merchant_slug: 'x1', merchant_domain: 'agoda.com', kind: k, title: 'Some offer', code: 'ABC' }).ok, true, k);
  }
});

test('merchant domain is normalised and validated', () => {
  assert.equal(cleanDomain('https://www.Agoda.com/en-in/search?x=1'), 'agoda.com');
  assert.equal(cleanDomain('agoda.com'), 'agoda.com');
  assert.equal(cleanSlug('MakeMyTrip Hotels!'), 'makemytrip-hotels');
  const bad = validatePromoOffer({ merchant_slug: 'a', merchant_domain: 'not a domain', kind: 'offer', title: 'Some offer' });
  assert.equal(bad.ok, false);
});

test('photo accepts an admin upload or https, refuses blob/data URLs', () => {
  const up = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', image_url: '/api/logos/promo-agoda-1' });
  assert.equal(up.ok, true, up.error);
  const ext = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', image_url: 'https://cdn.example.com/a.jpg' });
  assert.equal(ext.ok, true, ext.error);
  const blob = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', image_url: 'blob:http://localhost/x' });
  assert.equal(blob.ok, false);
  const data = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', image_url: 'data:image/png;base64,AAA' });
  assert.equal(data.ok, false);
});

test('affiliate template must be https and carry {url}', () => {
  const ok = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', affiliate_url: 'https://track.net/click?affid=3&url={url}' });
  assert.equal(ok.ok, true, ok.error);
  const missing = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', affiliate_url: 'https://track.net/click?affid=3' });
  assert.equal(missing.ok, false);
  const http = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', affiliate_url: 'http://track.net/?url={url}' });
  assert.equal(http.ok, false);
});

test('date window: end before start is rejected, ISO dates only', () => {
  const bad = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', starts_at: '2026-11-10', ends_at: '2026-11-01' });
  assert.equal(bad.ok, false);
  const junk = validatePromoOffer({ merchant_slug: 'agoda', merchant_domain: 'agoda.com', kind: 'offer', title: 'Hotel deal', starts_at: '10/11/2026' });
  assert.equal(junk.clean!.starts_at, null);
});

test('isPromoLive honours active flag and the window', () => {
  assert.equal(isPromoLive({ active: 1 }, '2026-10-27'), true);
  assert.equal(isPromoLive({ active: 0 }, '2026-10-27'), false);
  assert.equal(isPromoLive({ active: 1, starts_at: '2026-11-01' }, '2026-10-27'), false);
  assert.equal(isPromoLive({ active: 1, starts_at: '2026-10-01', ends_at: '2026-10-31' }, '2026-10-27'), true);
  assert.equal(isPromoLive({ active: 1, ends_at: '2026-10-20' }, '2026-10-27'), false);
  assert.equal(isPromoLive(null as any), false);
});

// ---- Excel sheet (owner: "kaun si company kiski partner hai" download) ----
function unzipStored(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < buf.length - 4 && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8');
    const start = i + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + size);
    out.set(name, method === 0 ? data.toString('utf8') : zlib.inflateRawSync(data).toString('utf8'));
    i = start + size;
  }
  return out;
}

test('xlsx is a valid zip with the standard parts and every sheet', () => {
  const buf = buildXlsx([
    { name: 'Partners', rows: [['Merchant', 'Network'], ['Agoda', 'LinkInR']], widths: [20, 20] },
    { name: 'Coupons', rows: [['Merchant', 'Code'], ['Agoda', 'T1S500']] },
  ]);
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const files = unzipStored(buf);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    assert.ok(files.has(part), `missing ${part}`);
  }
  assert.match(files.get('xl/workbook.xml')!, /name="Partners"/);
  assert.match(files.get('xl/workbook.xml')!, /name="Coupons"/);
  assert.match(files.get('xl/worksheets/sheet1.xml')!, /Agoda/);
  assert.match(files.get('xl/worksheets/sheet2.xml')!, /T1S500/);
});

test('xlsx escapes XML-hostile text so Excel never shows a broken sheet', () => {
  const buf = buildXlsx([{ name: 'P', rows: [['Name'], ['A & B <c> "d"']] }]);
  const sheet = unzipStored(buf).get('xl/worksheets/sheet1.xml')!;
  assert.ok(sheet.includes('A &amp; B &lt;c&gt; &quot;d&quot;'));
  assert.ok(!/<t[^>]*>[^<]*<c>/.test(sheet));
});

test('crc32 matches the known reference value and zipStore round-trips', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const z = zipStore([{ name: 'a.txt', data: Buffer.from('hello') }]);
  assert.equal(unzipStored(z).get('a.txt'), 'hello');
});

// The exit page markup must actually carry the promo strip + copy handler for the merchant.
test('redirect page renders the promo strip and copies with the merchant in scope', async () => {
  const { renderInterstitialPage } = await import('../server/redirect/interstitial');
  const html = renderInterstitialPage({ targetUrl: 'https://www.agoda.com/en-in/city/indore-in.html', partner: 'agoda.com', seconds: 4 });
  assert.match(html, /id="promos"/);
  assert.match(html, /\/api\/promo-offers\?merchant=/);
  assert.match(html, /navigator\.clipboard/);
  assert.match(html, /var partner = "agoda\.com"/);
  // The countdown and "Go now" link are untouched by the promo strip.
  assert.match(html, /Try1Second redirecting to agoda\.com in/);
  assert.match(html, /id="go"/);
});
