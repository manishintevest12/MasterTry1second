import test from 'node:test';
import assert from 'node:assert/strict';
import { cjClickBase, cjDeepUrl, _resetLinkInrHops } from '../server/affiliate/linkinr/deephop';
import { linkinrDeepTrackingUrl } from '../server/affiliate/linkinr';

// Owner 27 Oct: "agoda wagera sb add hai naa deeplink iss affiliate id se".
// LIVE-VERIFIED: linkinr.com drops &url=, but the CJ click URL it 302s to honours it.

const LIVE_CJ = 'https://www.tkqlhce.com/click-101523230-17095162?sid=01a17d53-759e-77e7-8039-027f8afbce24';

test('the live CJ hop becomes a reusable click base with per-click params stripped', () => {
  const base = cjClickBase(LIVE_CJ);
  assert.equal(base, 'https://www.tkqlhce.com/click-101523230-17095162');
});

test('every CJ network host is accepted, anything else is refused', () => {
  for (const h of ['tkqlhce.com', 'anrdoezrs.net', 'dpbolvw.net', 'jdoqocy.com', 'kqzyfj.com', 'www.anrdoezrs.net']) {
    assert.ok(cjClickBase(`https://${h}/click-1-2`), h);
  }
  assert.equal(cjClickBase('https://www.agoda.com/'), null);
  assert.equal(cjClickBase('not a url'), null);
});

test('the deep destination is appended, encoded, and attribution params stay', () => {
  const base = cjClickBase(LIVE_CJ)!;
  const deep = 'https://www.agoda.com/en-in/city/indore-in.html';
  const out = cjDeepUrl(base, deep);
  assert.equal(out, 'https://www.tkqlhce.com/click-101523230-17095162?url=https%3A%2F%2Fwww.agoda.com%2Fen-in%2Fcity%2Findore-in.html');
  assert.ok(out.includes('click-101523230-17095162'), 'campaign click id (our attribution) preserved');
  assert.ok(!/[?&]sid=/.test(out), 'volatile sid must not be reused');
});

test('a query string already on the base is extended with &, not a second ?', () => {
  assert.equal(cjDeepUrl('https://x.tkqlhce.com/click-1?a=1', 'https://m.com/p'),
    'https://x.tkqlhce.com/click-1?a=1&url=https%3A%2F%2Fm.com%2Fp');
});

test('non-LinkInR merchants still resolve to null (no behaviour change)', async () => {
  assert.equal(await linkinrDeepTrackingUrl('https://not-a-campaign.example.org/x'), null);
});

test('when the hop cannot be resolved the PLAIN LinkInR link is used (never lose the click)', async () => {
  _resetLinkInrHops();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('network down'); }) as any;
  try {
    const u = await linkinrDeepTrackingUrl('https://www.agoda.com/en-in/city/indore-in.html');
    assert.ok(u, 'must still return a tracking link');
    assert.match(String(u), /^https:\/\/linkinr\.com\?campaign_id=3NCvAx&inventory_id=dkNuid/);
  } finally { globalThis.fetch = realFetch; _resetLinkInrHops(); }
});

test('when the hop resolves to the CJ click, the DEEP url is returned instead', async () => {
  _resetLinkInrHops();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    status: 302,
    headers: new Map([['location', LIVE_CJ]]) as any,
  })) as any;
  // headers.get must work like the Headers API
  (globalThis.fetch as any) = async () => ({ status: 302, headers: { get: (k: string) => (k.toLowerCase() === 'location' ? LIVE_CJ : null) } });
  try {
    const u = await linkinrDeepTrackingUrl('https://www.agoda.com/en-in/city/indore-in.html');
    assert.match(String(u), /tkqlhce\.com\/click-101523230-17095162\?url=https%3A%2F%2Fwww\.agoda\.com/);
  } finally { globalThis.fetch = realFetch; _resetLinkInrHops(); }
});
