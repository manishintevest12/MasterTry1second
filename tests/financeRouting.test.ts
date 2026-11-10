/**
 * OWNER 10 Nov: "banking partners ke liye wo bhi cuelinks, vcommission, admitad, linkinr par available hai".
 * Measured on our own publisher accounts that day: the ISSUERS we exit to already pay (LinkInR holds HDFC
 * Tata Neu 140, Axis CC up to 1600, IDFC up to 1040, Federal 900, AU 340, BOB 1000, Acko/ICICI Lombard rev
 * share), Kotak811 (210/lead) and Zurich Kotak (22.5%) are Cuelinks-approved, and the aggregators
 * (BankBazaar, PaisaBazaar, PolicyBazaar, Coverfox, InsuranceDekho, CardInsider) have NO campaign on
 * Cuelinks, LinkInR, Admitad or vCommission yet - they need direct publisher programs. Those aggregators must
 * therefore still keep their deep product path instead of being swallowed by a campaign that does not exist,
 * and must be ready to pay the day an approval lands without a deploy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSecureDeeplink, cuelinksMerchantUrl } from '../server/affiliate/deeplink';

const run = async (u: string) => (await buildSecureDeeplink(u)) as any;

test('issuer finance exits ride the GroMo advisor link, which covers every product', async () => {
  // OWNER 10 Nov: "gromo ke saare products add kr do, wahi link jo diya tha ussi mein mera id hint hai".
  // The advisor code is his ID, so an issuer row exits through GroMo instead of a per-campaign network link;
  // these same issuers used to ride LinkInR, and GROMO_SKIP_DOMAINS hands any of them back when he prefers.
  for (const u of [
    'https://www.hdfc.bank.in/credit-cards',
    'https://web.axis.bank.in/credit-card',
    'https://www.idfcfirst.bank.in/credit-card/',
    'https://creditcards.federalbank.co.in/',
    'https://www.au.bank.in/credit-card',
    'https://www.acko.com/',
    'https://www.icicilombard.com/',
  ]) {
    const r = await run(u);
    assert.equal(r.network, 'gromo', `${u} must ride the GroMo advisor link`);
    assert.equal(r.matchedProfile, 'gromo_advisor');
    assert.match(String(r.trackingUrl), /^https:\/\/sales\.gromo\.in\/ac\//);
  }
});

test('GROMO_SKIP_DOMAINS hands a specific issuer back to the network that pays it', async () => {
  process.env.GROMO_SKIP_DOMAINS = 'federalbank.co.in';
  try {
    const r = await run('https://creditcards.federalbank.co.in/');
    assert.equal(r.network, 'linkinr', 'a skipped issuer falls through to LinkInR');
  } finally { delete process.env.GROMO_SKIP_DOMAINS; }
});

test('a Cuelinks-approved finance partner can be pinned back over GroMo with a skip entry', async () => {
  process.env.GROMO_SKIP_DOMAINS = 'kotak811.com,zurichkotak.com';
  try {
    for (const u of ['https://www.kotak811.com/', 'https://www.zurichkotak.com/']) {
      const r = await run(u);
      assert.equal(r.network, 'cuelinks', `${u} is approved on Cuelinks and pinned back`);
      assert.equal(r.matchedProfile, 'cuelinks_approved');
      assert.ok(String(r.trackingUrl).includes(encodeURIComponent(u)), `${u} keeps its destination`);
    }
  } finally { delete process.env.GROMO_SKIP_DOMAINS; }
});

test('aggregators with no campaign anywhere keep their deep path and are wrapped for the day they are approved', async () => {
  const aggregators = [
    'https://www.bankbazaar.com/credit-card.html',
    'https://www.paisabazaar.com/personal-loan/',
    'https://www.policybazaar.com/health-insurance/',
    'https://www.coverfox.com/',
    'https://www.insurancedekho.com/',
    'https://www.cardinsider.com/',
    'https://www.getditto.com/',
  ];
  // Issuers and insurers that used to sit here now ride the GroMo advisor link (see gromo.test.ts), so this
  // test covers exactly the aggregator family that must never be handed to GroMo.
  for (const u of aggregators) {
    const r = await run(u);
    assert.equal(r.network, 'cuelinks', `${u} must be wrapped so approval pays with no deploy`);
    assert.equal(r.matchedProfile, 'cuelinks_fallback');
    assert.ok(String(r.trackingUrl).includes(encodeURIComponent(u)), `${u} must keep its deep product path`);
    assert.ok(cuelinksMerchantUrl(u, 'all'), `${u} must be on the Cuelinks allow-list`);
  }
});

test('no finance click is lost to a network that pays nothing', async () => {
  const lenderHosts = ['https://www.hdfc.bank.in/', 'https://www.kotak811.com/', 'https://www.bankbazaar.com/'];
  for (const u of lenderHosts) {
    const r = await run(u);
    assert.notEqual(r.network, null, `${u} must not exit untracked`);
    assert.notEqual(r.matchedProfile, 'direct', `${u} must not fall through to a direct hop`);
  }
});
