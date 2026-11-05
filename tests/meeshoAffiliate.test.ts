import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMeeshoAffiliateConfigured, meeshoAffiliateUrl } from '../server/affiliate/meeshoAffiliate';
import { merchantDeepLink } from '../server/affiliate/merchantLinks';

// OWNER 5 Nov: he has a Meesho affiliate account. With no template configured the exit must stay
// exactly as today (fail closed); once the portal's copied link is supplied, every Meesho exit in
// every vertical carries his id. Nothing may ever throw or produce an insecure URL.

test('unconfigured: the Meesho exit is untouched', () => {
  delete process.env.MEESHO_AFFILIATE_LINK_TEMPLATE;
  delete process.env.MEESHO_AFFILIATE_PARAMS;
  assert.equal(isMeeshoAffiliateConfigured(), false);
  const url = 'https://www.meesho.com/search?q=mobile%20phone';
  assert.equal(meeshoAffiliateUrl(url), url);
  assert.match(merchantDeepLink('Meesho', 'mobile phone', 'ecommerce'), /^https:\/\/www\.meesho\.com\/search\?q=/);
});

test('onelink style template with {url} carries the destination', () => {
  process.env.MEESHO_AFFILIATE_LINK_TEMPLATE =
    'https://meesho.onelink.me/2yoV/abc123?af_xp=app&pid=affiliate&af_dp={urlEncoded}';
  try {
    const dest = 'https://www.meesho.com/search?q=tata%20tea';
    const out = meeshoAffiliateUrl(dest);
    assert.match(out, /^https:\/\/meesho\.onelink\.me\/2yoV\/abc123\?/);
    assert.ok(out.includes('pid=affiliate'), 'the affiliate id param must survive');
    assert.ok(decodeURIComponent(out).includes(dest), 'the destination must be carried');
    // and the merchant builder now emits the monetised link
    assert.match(merchantDeepLink('Meesho', 'tata tea', 'ecommerce'), /meesho\.onelink\.me/);
  } finally {
    delete process.env.MEESHO_AFFILIATE_LINK_TEMPLATE;
  }
});

test('short-link style template gets the destination as its url parameter', () => {
  process.env.MEESHO_AFFILIATE_LINK_TEMPLATE = 'https://bitli.in/AbC123';
  try {
    const out = meeshoAffiliateUrl('https://www.meesho.com/search?q=milk');
    assert.match(out, /^https:\/\/bitli\.in\/AbC123\?url=/);
    assert.ok(out.includes(encodeURIComponent('https://www.meesho.com/search?q=milk')));
  } finally {
    delete process.env.MEESHO_AFFILIATE_LINK_TEMPLATE;
  }
});

test('a bad template never breaks the exit', () => {
  process.env.MEESHO_AFFILIATE_LINK_TEMPLATE = 'http://insecure.example.com/x?url={url}';
  try {
    const dest = 'https://www.meesho.com/search?q=milk';
    const out = meeshoAffiliateUrl(dest);
    assert.equal(out, dest, 'non-https template is ignored, never used');
  } finally {
    delete process.env.MEESHO_AFFILIATE_LINK_TEMPLATE;
  }
});

test('plain params are appended when the operator supplies them', () => {
  delete process.env.MEESHO_AFFILIATE_LINK_TEMPLATE;
  process.env.MEESHO_AFFILIATE_PARAMS = 'sub_id=try1second&utm_source=t1s';
  try {
    const out = meeshoAffiliateUrl('https://www.meesho.com/search?q=milk');
    assert.ok(out.includes('sub_id=try1second'));
    assert.ok(out.includes('utm_source=t1s'));
    assert.ok(out.includes('q=milk'), 'the search must survive');
  } finally {
    delete process.env.MEESHO_AFFILIATE_PARAMS;
  }
});
