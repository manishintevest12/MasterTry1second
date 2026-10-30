import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * OWNER 30 Oct: the apex -> www 301 must never swallow the verification files, and the
 * verifier routes must be registered BEFORE that redirect. The behaviour itself is
 * covered by canonicalHost.test.ts (policy) and verifierRouteOrder.test.ts (real HTTP);
 * this file pins the wiring in server/index.ts so the guard cannot be dropped by a
 * future refactor that inlines the redirect again.
 */
const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

test('index.ts delegates the apex redirect to the tested policy module', () => {
  assert.match(src, /import \* as canonicalHost from '\.\/common\/canonicalHost'/);
  assert.match(src, /shouldRedirectApexToWww\(req\.headers\.host, req\.path \|\| req\.url\)/);
  assert.doesNotMatch(src, /res\.redirect\(301, `https:\/\/www\.try1second\.com\$\{req\.originalUrl/);
});

test('verification routes are registered before the canonical redirect middleware', () => {
  const routesAt = src.indexOf('registerAppLinkRoutes(app');
  const redirectAt = src.indexOf('shouldRedirectApexToWww(req.headers.host');
  assert.ok(routesAt > 0, 'app link routes are registered');
  assert.ok(redirectAt > 0, 'canonical redirect middleware present');
  assert.ok(routesAt < redirectAt, 'routes must come first so no redirect can shadow them');
});
