import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { securityHeaders, apiRateLimit, resetRateLimitState, securityTxt } from '../server/security/security';
import { brandPage, isBrandPagePath, BRAND_PAGE_PATH, BRAND_FACT_LINE } from '../server/seo/brandPage';
import { resolveSeoPage, listSeoPaths } from '../server/seo/data';
import { llmsText } from '../server/seo/agentReady';
import { robotsText } from '../server/seo/sitemap';

test('every response carries the security headers, and the CSP is report-only', async () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/x', (_req, res) => res.send('ok'));
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const res = await fetch(`http://127.0.0.1:${port}/x`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(String(res.headers.get('permissions-policy')), /camera=\(\)/);
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  // report-only: an enforcing CSP would break AdSense and the Vite bundle
  assert.ok(res.headers.get('content-security-policy-report-only'));
  assert.equal(res.headers.get('content-security-policy'), null);
  server.close();
});

test('the search endpoints are rate limited but a normal search is never blocked', async () => {
  resetRateLimitState();
  const app = express();
  app.use(apiRateLimit({ limit: 3, windowMs: 60_000 }));
  app.post('/api/search', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const call = () => fetch(`http://127.0.0.1:${port}/api/search`, { method: 'POST' });
  const first = await Promise.all([call(), call(), call()]);
  assert.deepEqual(first.map((r) => r.status), [200, 200, 200]);
  const blocked = await call();
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  server.close();
});

test('security.txt is an RFC 9116 file with a real public contact', () => {
  const txt = securityTxt();
  assert.match(txt, /^Contact: mailto:info@try1second\.com$/m);
  assert.match(txt, /^Expires: \d{4}-\d{2}-\d{2}T/m);
  assert.match(txt, /^Canonical: https:\/\/www\.try1second\.com\/\.well-known\/security\.txt$/m);
});

test('the spaced brand spelling has a real page whose title, H1 and URL all answer it', () => {
  const page = brandPage();
  assert.equal(page.path, BRAND_PAGE_PATH);
  assert.equal(page.path, '/try-1-second');
  assert.match(page.title, /Try 1 Second/);
  assert.match(page.h1, /Try 1 Second/);
  assert.ok(isBrandPagePath('/try-1-second/'));
  assert.ok(!isBrandPagePath('/try-1-second-xyz'));
  // resolver: the URL a searcher would land on is served, and it is in the sitemap
  const resolved = resolveSeoPage('/try-1-second');
  assert.ok(resolved && /Try 1 Second/.test(resolved.title));
  assert.ok(listSeoPaths().includes('/try-1-second'));
  // honesty: no price and no "best" claim on a page with no live search behind it
  const body = [page.title, page.description, page.h1, ...page.intro, ...page.faqs.flatMap((f) => [f.q, f.a])].join(' ');
  assert.ok(!/₹/.test(body), 'a brand page must not carry a price');
  assert.ok(!/\bbest\b/i.test(body), 'a brand page must not claim to be the best');
});

test('the machine index states the brand identity and the "1 Second Everyday" separation', () => {
  const llms = llmsText();
  assert.ok(llms.includes(BRAND_FACT_LINE));
  assert.match(llms, /Try 1 Second/);
  assert.match(llms, /1 Second Everyday/);
  assert.ok(llms.includes('/try-1-second'));
});

test('robots.txt names the AI crawlers explicitly and keeps training declined', () => {
  const robots = robotsText();
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot', 'CCBot', 'Bingbot']) {
    assert.match(robots, new RegExp(`User-agent: ${bot}\\nAllow: /`), `${bot} must be named`);
  }
  assert.match(robots, /Content-Signal: search=yes, ai-input=yes, ai-train=no/);
  assert.match(robots, /security\.txt/);
});
