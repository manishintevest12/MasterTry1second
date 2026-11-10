import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * OWNER 10 Nov: "logo add kro bina new build kiye server se". Relative logo paths do not survive installed
 * builds, because a relative path is resolved against the app's API base (the Cloudflare relay), which only
 * authorises the Dart UA and answers 401 to Image.network - leaving the initials badge. Absolute origin URLs
 * fix every build already on a phone, so the payload must never hand out a relative logo path.
 */
const SRC = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');

test('seller logos are emitted as absolute public-origin URLs', () => {
  assert.match(SRC, /const PUBLIC_ORIGIN =/);
  assert.match(SRC, /const absoluteLogo = \(key: string\) => \(key \? `\$\{PUBLIC_ORIGIN\}\/api\/logos\/\$\{key\}` : ''\)/);
  assert.match(SRC, /sellerLogo: absoluteLogo\(logoKey\)/);
  assert.match(SRC, /sellerLogo: absoluteLogo\(merchantKeyOf\(sd\.seller\)\)/);
  // a relative path must never be emitted again
  assert.ok(!/sellerLogo: logoKey \? `\/api\/logos/.test(SRC));
});

test('every brand the app can draw has a domain for its real mark', async () => {
  const { resolveBrandFavicon } = await import('../server/marketing/merchantLogos');
  // the four sellers in the owner's screenshot plus the biggest row-producing sellers
  for (const key of ['reliance', 'reliancedigital', 'shopsy', 'myntra', 'flipkart', 'amazon', 'nykaa', 'croma', 'tatacliq', 'meesho', 'blinkit', 'zepto', 'bigbasket', 'swiggy', 'zomato', 'oyo', 'agoda', 'makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'easemytrip', 'redbus', 'airindia', 'indigo', 'akasa', 'spicejet', 'uber', 'rapido', 'bookmyshow', 'kotak', 'hdfc', 'axio']) {
    const got = await resolveBrandFavicon(key === 'axio' ? 'axis' : key).catch(() => null);
    assert.ok(got && got.bytes.length > 100, `${key} must resolve a real image`);
  }
});
