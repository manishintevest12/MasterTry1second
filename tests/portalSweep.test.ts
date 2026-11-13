/**
 * OWNER 13 Nov: "admin ka hr tab, merchant ka hr tab ke hr section hr feature hr button fix kro" - after the
 * finance photo upload reported failure on an HTTP 200 success. These pin the sweep: no tab can misread a
 * successful admin write, the merchant portal actually authenticates its traffic call, and the global affiliate
 * sync is not open to anonymous POSTs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every admin JSON answer carries success and ok, so no tab misreads a good write', () => {
  const src = readFileSync('server/admin/adminRoutes.ts', 'utf8');
  const at = src.indexOf('adminRouter.use((_req, res, next)');
  assert.ok(at > 0, 'the normaliser must be mounted on the admin router');
  const block = src.slice(at, at + 3000);
  assert.match(block, /\.ok !== undefined \? Boolean/, 'success derives from ok');
  assert.match(block, /patched\.ok = success/, 'ok derives from success');
  assert.match(block, /status >= 400/, 'a 4xx/5xx payload can never claim success');
});

test('merchant portal sends its own session to /api/vendor/traffic', () => {
  for (const f of ['src/components/merchant/MerchantAnalyticsTab.tsx', 'src/components/merchant/MerchantOrdersTab.tsx']) {
    const src = readFileSync(f, 'utf8');
    const at = src.indexOf('`/api/vendor/traffic');
    assert.ok(at > 0, `${f} calls the traffic endpoint`);
    const window = src.slice(at, at + 320);
    assert.match(window, /t1s_merchant_token/, `${f} must send the merchant token (requireAuth 401 showed zeros)`);
  }
});

test('the affiliate sync trigger is admin-only', () => {
  const src = readFileSync('server/affiliate/api.ts', 'utf8');
  const at = src.indexOf("affiliateRouter.post('/sync'");
  const line = src.slice(at, src.indexOf('\n', at));
  assert.match(line, /authMiddleware/, 'anonymous callers must not start a network sweep');
  assert.match(line, /requireAdmin/);
});
