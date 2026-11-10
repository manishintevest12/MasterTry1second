import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gromoFinanceSponsor, gromoBannerUrl, isFinanceVertical } from '../server/marketing/financeSponsor';
import { resolveMaskingPointer } from '../server/affiliate/deeplink';

/**
 * OWNER 10 Nov, reported a second time: "gromo sites pr ni dikh raha loan, account, credit card, insurance
 * vertical mai aur naa hi app pr isme image v add kr naa".
 *
 * The routing was already correct, but a finance search returns aggregator issuer pages (BankBazaar,
 * PolicyBazaar), which the GroMo wrap deliberately skips, so the advisor link had no surface at all. It now
 * has a featured-partner slot that both clients already know how to render.
 */
test('all four finance verticals get a GroMo featured partner with an image', () => {
  for (const v of ['loans', 'creditcards', 'insurance', 'account', 'banking']) {
    const slot = gromoFinanceSponsor(v);
    assert.ok(slot, `${v} must have a GroMo slot`);
    assert.equal(slot.provider, 't1s_house');
    assert.equal(slot.deals.length, 1);
    const deal = slot.deals[0];
    assert.equal(deal.merchant, 'GroMo');
    assert.match(deal.image, /^https:\/\//, 'the app only accepts an https image');
    assert.ok(deal.title.length > 20 && deal.title.length <= 90, 'title fits the card');
  }
});

test('the tap target is a masked /api/out pointer that resolves to the real advisor link', () => {
  const deal = gromoFinanceSponsor('loans').deals[0];
  assert.match(deal.url, /^\/api\/out\?t=/);
  const back = resolveMaskingPointer(String(deal.url).replace('/api/out?t=', ''));
  assert.ok(back, 'pointer must resolve');
  assert.match(String(back!.destination), /^https:\/\/sales\.gromo\.in\/ac\/[A-Za-z0-9]+$/,
    'the destination is the advisor landing link itself (GroMo carries no subid parameter)');
  assert.equal((back as any).vertical, 'loans', 'vertical rides the pointer so /api/out routes it honestly');
});

test('non-finance verticals never get the GroMo card (their own deals strip keeps working)', () => {
  for (const v of ['ecommerce', 'hotels', 'flights', 'bus', 'cab', 'food', 'grocery', 'movies']) {
    assert.equal(gromoFinanceSponsor(v), null, v);
    assert.equal(isFinanceVertical(v), false, v);
  }
});

test('/api/ads asks for the GroMo card before the deals strip', () => {
  const src = readFileSync('server/api/routes.ts', 'utf8');
  const ads = src.slice(src.indexOf("apiRouter.get('/ads'"));
  const gromoAt = ads.indexOf('gromoFinanceSponsor(verticalName)');
  const houseAt = ads.indexOf('houseSponsorFor(verticalName)');
  assert.ok(gromoAt > 0 && houseAt > gromoAt, 'GroMo must be tried before the deals registry fallback');
});

test('banner is overridable per environment and always https', () => {
  const before = process.env.T1S_GROMO_BANNER_URL;
  process.env.T1S_GROMO_BANNER_URL = 'http://insecure.example/x.png';
  assert.match(gromoBannerUrl(), /^https:\/\//, 'http is refused');
  process.env.T1S_GROMO_BANNER_URL = 'https://cdn.example/gromo.png';
  assert.equal(gromoBannerUrl(), 'https://cdn.example/gromo.png');
  if (before === undefined) delete process.env.T1S_GROMO_BANNER_URL; else process.env.T1S_GROMO_BANNER_URL = before;
});

test('the advisor landing link is never re-wrapped by a network on click', async () => {
  const { buildSecureDeeplink } = await import('../server/affiliate/deeplink');
  const r = await buildSecureDeeplink('https://sales.gromo.in/ac/CCiv1ofkx2', { vertical: 'loans' });
  assert.equal(r.network, 'gromo');
  assert.equal(r.trackingUrl, 'https://sales.gromo.in/ac/CCiv1ofkx2');
});

test('the advisor is a RESULT ROW too, so every client version renders it (owner 10 Nov, third report)', async () => {
  const { gromoResultRow, withGromoRow } = await import('../server/marketing/financeSponsor');
  for (const v of ['loans', 'creditcards', 'insurance', 'account']) {
    const row: any = gromoResultRow(v);
    assert.ok(row, `${v} needs a row`);
    assert.equal(row.seller, 'GroMo');
    assert.equal(row.isSponsored, true);
    assert.equal(row.vertical, v);
    assert.match(row.sellerUrl, /^\/api\/out\?t=/);
    assert.match(row.attributes.image_url, /^https:\/\//);
    assert.equal(row.prices.priceAvailable, false, 'no fare is invented for an advisor');
    const rows = withGromoRow([{ id: 'a' }, { id: 'b' }], v);
    assert.equal(rows[0].id, row.id, 'row is first');
    assert.equal(rows.length, 3, 'nothing else is dropped');
    assert.equal(withGromoRow([{ id: row.id }], v).length, 1, 'never duplicated');
  }
  assert.equal(gromoResultRow('flights'), null);
  assert.deepEqual(withGromoRow([{ id: 'x' }], 'hotels'), [{ id: 'x' }]);
});

test('/api/search and /api/scrape/live both get the row through finaliseLiveAnswer', async () => {
  const src = readFileSync('server/api/routes.ts', 'utf8');
  const fn = src.slice(src.indexOf('function finaliseLiveAnswer'), src.indexOf('async function lastChanceRows'));
  assert.match(fn, /withGromoRow\(/, 'the shared finaliser injects it, so both endpoints inherit it');
  assert.ok(src.includes("import { withGromoRow } from '../marketing/financeSponsor';"), 'static import, no await in a sync finaliser');
});
