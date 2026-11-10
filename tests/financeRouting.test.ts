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

test('issuer finance exits use the network that actually pays, with the real campaign', async () => {
  for (const [u, net] of [
    ['https://www.hdfc.bank.in/credit-cards', 'linkinr'],
    ['https://web.axis.bank.in/credit-card', 'linkinr'],
    ['https://www.idfcfirst.bank.in/credit-card/', 'linkinr'],
    ['https://creditcards.federalbank.co.in/', 'linkinr'],
    ['https://www.au.bank.in/credit-card', 'linkinr'],
    ['https://www.acko.com/', 'linkinr'],
    ['https://www.icicilombard.com/', 'linkinr'],
  ]) {
    const r = await run(u);
    assert.equal(r.network, net, `${u} must ride ${net}`);
    assert.ok(String(r.trackingUrl).startsWith('https://linkinr.com?'), `${u} gets a real LinkInR campaign link`);
  }
});

test('Cuelinks-approved finance partners are claimed before LinkInR and keep the deep path', async () => {
  for (const u of ['https://www.kotak811.com/', 'https://www.zurichkotak.com/']) {
    const r = await run(u);
    assert.equal(r.network, 'cuelinks', `${u} is approved on Cuelinks`);
    assert.equal(r.matchedProfile, 'cuelinks_approved');
    assert.ok(String(r.trackingUrl).includes(encodeURIComponent(u)), `${u} keeps its destination`);
  }
});

test('aggregators with no campaign anywhere keep their deep path and are wrapped for the day they are approved', async () => {
  const aggregators = [
    'https://www.bankbazaar.com/credit-card.html',
    'https://www.paisabazaar.com/personal-loan/',
    'https://www.policybazaar.com/health-insurance/',
    'https://www.coverfox.com/',
    'https://www.insurancedekho.com/',
    'https://www.cardinsider.com/',
    'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan',
    'https://www.bajajfinserv.in/personal-loan',
    'https://www.kreditbee.in/',
    'https://www.moneyview.in/',
    'https://www.godigit.com/',
    'https://www.hdfcergo.com/',
    'https://www.getditto.com/',
  ];
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
