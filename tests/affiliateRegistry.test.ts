import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProfile } from '../server/affiliate/profiles';

// Owner 27 Oct: "jinn company pr affiliate id ni hai usko admin mai add kro aur unke
// affiliate id ko khali rkho jiss se unka affiliate aate hi hum admin mai manually add
// kr ske" — a merchant with NO program must still be registerable.
test('a merchant can be registered with an EMPTY affiliate id and empty template', () => {
  const v = validateProfile({ slug: 'blinkit', company_domain: 'blinkit.com', network: 'direct', template: '', monetization: 'adsense' });
  assert.equal(v.ok, true, v.error);
  assert.equal(v.clean!.template, null);
  assert.equal(v.clean!.affiliate_id, null);
  assert.equal(v.clean!.monetization, 'adsense');
});

test('pasting the affiliate id later is accepted (no template needed)', () => {
  const v = validateProfile({ slug: 'zepto', company_domain: 'zeptonow.com', network: 'direct', template: '', affiliate_id: 'T1S-ZEPTO-42' });
  assert.equal(v.ok, true, v.error);
  assert.equal(v.clean!.affiliate_id, 'T1S-ZEPTO-42');
  assert.equal(v.clean!.monetization, 'affiliate');
});

test('a non-empty template must still be a real https tracking link', () => {
  const bad = validateProfile({ slug: 'x', company_domain: 'x.com', network: 'cuelinks', template: 'http://insecure/{url}' });
  assert.equal(bad.ok, false);
  const good = validateProfile({ slug: 'y', company_domain: 'y.com', network: 'cuelinks', template: 'https://track.example.com/click?url={url}' });
  assert.equal(good.ok, true, good.error);
});

test('migration seeds every registry merchant empty + marks only true adsense-only ones', () => {
  const sql = fs.readFileSync('database/migrations/023_affiliate_registry_seed.sql', 'utf8');
  for (const slug of ['amazon', 'blinkit', 'zepto', 'swiggy-instamart', 'bigbasket', 'flipkart-minutes']) {
    assert.ok(sql.includes(`('${slug}',`), `${slug} seeded`);
  }
  const rows = sql.split('\n').map((l) => l.trim()).filter((l) => l.startsWith("('"));
  assert.ok(rows.length >= 60, `expected the whole registry, got ${rows.length}`);
  // Every seeded row starts with NO affiliate id/template: the owner fills them later.
  for (const r of rows) assert.match(r, /,NULL,NULL,'(affiliate|adsense)'/, r);
  // Adsense set is exactly the merchants with no affiliate program.
  const adsense = rows.filter((r) => r.includes("'adsense'")).map((r) => r.match(/^\('([^']+)'/)![1]);
  assert.deepEqual(adsense.sort(), ['bigbasket', 'blinkit', 'swiggy-instamart', 'zepto']);
  // Flipkart Minutes rides on Flipkart (Ekaro-convertible) so it stays affiliate.
  const fk = rows.find((r) => r.startsWith("('flipkart-minutes'"))!;
  assert.ok(fk.includes("'affiliate'"), fk);
});
