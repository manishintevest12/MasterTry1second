import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// OWNER 7 Nov ("product page pr logo and image ni aa raha related products section mai"): every
// related row came back with image: null while the same rows in `offers` had photos, because the row
// mapper only read attributes.image_url. Each parser spells the product photo differently, so the
// mapper must read every honest spelling, and the app must fall back to the seller logo.
test('the product-page row mapper reads every parser photo spelling', () => {
  const src = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');
  for (const key of ['attrs.image_url', 'attrs.image', 'o.imageUrl', 'o.thumbnail', 'attrs.image_urls']) {
    assert.ok(src.includes(key), `row mapper must read ${key}`);
  }
});

test('the app falls back to the seller logo when a related row has no photo', () => {
  const app = readFileSync(new URL('../flutter_app/lib/ui/screens/product_screen.dart', import.meta.url), 'utf8');
  assert.ok(app.includes('_absLogo(page.related[r0 + k].sellerLogo)'), 'logo fallback wired into the grid');
  assert.ok(app.includes('String? _absLogo('), 'logo path is made absolute');
});
