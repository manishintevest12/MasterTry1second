import test from 'node:test';
import assert from 'node:assert/strict';
import { maskId, resolveEffective } from '../server/affiliate/coverageMap';

// Owner 27 Oct: "jisme affiliate id hai wo v dikhenge admin mai" — the admin rows must
// show which affiliate id actually fires, automatic layers included.
test('ids are masked, never shown whole in the list', () => {
  assert.equal(maskId(''), '');
  const masked = maskId('try1second-21');
  assert.ok(masked.endsWith('d-21'), masked);
  assert.ok(!masked.includes('try1second'), masked);
  assert.equal(maskId('abcd'), '••••');
});

test('a manual template wins and its embedded id is shown masked', async () => {
  const rows = await resolveEffective([
    { slug: 'flipkart', company_domain: 'flipkart.com', template: 'https://linksredirect.com/?cid=123&pub_id=278473&url={url}' },
  ]);
  assert.equal(rows[0].effective_source, 'affiliate_configs');
  assert.ok(rows[0].effective_id_masked.endsWith('8473'), rows[0].effective_id_masked);
});

test('explicit affiliate_id beats the id found inside the template', async () => {
  const rows = await resolveEffective([
    { slug: 'x', company_domain: 'x.com', template: 'https://t.example/click?aff=1&url={url}', affiliate_id: 'MY-OWN-ID-99' },
  ]);
  assert.equal(rows[0].effective_source, 'affiliate_configs');
  assert.ok(rows[0].effective_id_masked.endsWith('-99'), rows[0].effective_id_masked);
});

test('adsense merchants report adsense, empty configs report direct', async () => {
  const rows = await resolveEffective([
    { slug: 'blinkit', company_domain: 'blinkit.com', template: null, monetization: 'adsense' },
    { slug: 'nobody', company_domain: 'nobody.example', template: null, monetization: 'affiliate' },
  ]);
  assert.equal(rows[0].effective_source, 'adsense');
  assert.equal(rows[0].effective_id_masked, '');
  assert.ok(['direct', 'ekaro'].includes(rows[1].effective_source), rows[1].effective_source);
});
