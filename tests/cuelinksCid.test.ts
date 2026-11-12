/**
 * OWNER 12 Nov: a click landed on cuelinks.com/broken-links. MEASURED against linksredirect.com today with
 * our exact link shape: cid=326794 gives a real attributed hop (tracking.icubeswire.co), while cid=278473 -
 * our PUBLISHER id - answers cuelinks.com/broken-links. These tests pin the guard and the one verified shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCuelinksCid, buildCuelinksDeepLink, KNOWN_GOOD_CUELINKS_CID } from '../server/affiliate/cuelinksCid';
import { settings } from '../server/common/settings';

function withCid<T>(cid: string, fn: () => T): T {
  const prev = settings.cuelinks.cid;
  (settings as any).cuelinks = { ...settings.cuelinks, cid };
  try { return fn(); } finally { (settings as any).cuelinks = { ...settings.cuelinks, cid: prev }; }
}

test('the publisher id is never accepted as a cid', () => {
  const publisher = settings.cuelinks.publisherId;
  withCid(publisher, () => {
    assert.equal(resolveCuelinksCid(), KNOWN_GOOD_CUELINKS_CID, 'must fall back to the verified cid');
    const link = buildCuelinksDeepLink('https://www.makemytrip.com/hotels/');
    assert.ok(link && link.includes(`cid=${KNOWN_GOOD_CUELINKS_CID}`), link || 'no link');
    assert.ok(!link!.includes(`cid=${publisher}`), 'publisher id must never appear in the cid slot');
  });
});

test('a real cid is respected, junk is not', () => {
  withCid('326794', () => assert.equal(resolveCuelinksCid(), '326794'));
  withCid('not-a-cid', () => assert.equal(resolveCuelinksCid(), KNOWN_GOOD_CUELINKS_CID));
  withCid('', () => assert.equal(resolveCuelinksCid(), KNOWN_GOOD_CUELINKS_CID));
});

test('one verified link shape, non-https destinations refused', () => {
  const link = withCid('326794', () => buildCuelinksDeepLink('https://www.cleartrip.com/hotels/india', '278473'));
  assert.ok(link!.startsWith('https://linksredirect.com/?cid=326794'), link || 'no link');
  assert.ok(link!.includes('source=api'), 'the measured shape uses source=api');
  assert.ok(link!.includes('subid=278473'), 'our publisher id travels as subid for reporting');
  assert.ok(link!.includes(`url=${encodeURIComponent('https://www.cleartrip.com/hotels/india')}`));
  assert.ok(!link!.includes('type=nl'), 'the dead type=nl shape must not come back');
  assert.equal(buildCuelinksDeepLink('http://insecure.example.com/'), null, 'http is refused');
  assert.equal(buildCuelinksDeepLink('not a url'), null);
});

test('no builder anywhere still interpolates a raw cid', () => {
  for (const f of ['server/affiliate/affiliateNetwork.ts', 'server/affiliate/deeplink.ts', 'server/affiliate/appCampaigns.ts']) {
    const src = readFileSync(f, 'utf8');
    // Comments are allowed to mention the old shape; CODE must not emit it.
    const code = src.split('\n').filter((l: string) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    assert.ok(!/linksredirect\.com\/\?cid=\$\{encodeURIComponent\(c\.cid\)\}/.test(code), `${f} must use the shared builder`);
    assert.ok(!code.includes('type=nl'), `${f} must not emit the dead type=nl shape`);
  }
});
