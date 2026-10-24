import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cabSrc = readFileSync('server/workers/verticals/cab.ts', 'utf8');

// Owner 24 Oct evening ("uber/rapido ka real price chaiye, fare on app ni"):
// Uber India's official Price Estimates API returns `estimate` as a localized
// STRING ("₹221", "₹110-130", "Metered") — Number("₹221") is NaN, so even with a
// valid UBER_SERVER_TOKEN every quoted row was silently dropped. The parser must
// now pull the digits out of the string honestly (ranges -> midpoint).
test('cab.ts parses localized Uber estimate strings (₹ / range / Metered)', () => {
  assert.ok(/const parseUberEstimate = \(p: any\): number =>/.test(cabSrc), 'parseUberEstimate helper exists');
  assert.ok(cabSrc.includes('const nums = (est.match(/[\\d,.]+/g) || [])'), 'digit extraction from the estimate string');
  assert.ok(cabSrc.includes('if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);'), 'range midpoint');
  assert.ok(cabSrc.includes('const price = parseUberEstimate(p);'), 'task uses the honest parser');
});

// Owner rule: Ola deeplinks must carry BOTH endpoints (payment-page depth).
test('cab.ts Ola deeplinks prefill pickup AND drop coordinates', () => {
  assert.ok(cabSrc.includes("ul.searchParams.set('drop_lat', String(b.lat));"), 'rate-card branch prefills drop');
  assert.ok(/sellerUrl: `https:\/\/book\.olacabs\.com\/\?lat=\$\{a\.lat\}&lng=\$\{a\.lon\}&drop_lat=\$\{b\.lat\}&drop_lng=\$\{b\.lon\}`/.test(cabSrc), 'API branch prefills drop');
});

// Owner 24 Oct: app-only cab rows (Uber/Rapido catalog, price_basis=app_only_fares)
// render the honest 'Fare on app' label in BOTH web tables and the Flutter
// group card (web parity rule).
test('web + Flutter render Fare on app for app_only_fares rows', () => {
  const tdr = readFileSync('src/components/TravelDealRow.tsx', 'utf8');
  assert.ok(tdr.includes("spec(r.item, 'price basis', 'price_basis') === 'app_only_fares' ? 'Fare on app' : 'Price on site'"), 'TravelDealRow extraRows label');
  const cc = readFileSync('src/components/ComparisonCard.tsx', 'utf8');
  assert.ok(cc.includes("'app_only_fares' ? 'Fare on app' : 'Price on site'"), 'ComparisonCard siteRows label');
  const dart = readFileSync('flutter_app/lib/ui/widgets/compare_cards.dart', 'utf8');
  assert.ok(dart.includes("it.spec('price basis', 'price_basis') == 'app_only_fares' ? 'Fare on app' : 'Price on site'"), 'Flutter group card label');
});
